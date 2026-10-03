# Implementation Plan: Ações pelo MCP — Contas a Pagar e Importação de Vendas

**Branch**: `028-mcp-write-actions` | **Date**: 2026-10-03 | **Spec**: [spec.md](./spec.md)

## Summary

O MCP da loja ganha **tools de ação** (escrita) para contas a pagar e importação de vendas via API, protegidas por três travas:

1. **Loja**: `StoreMcpConfiguration.actionsEnabled` (desligado por padrão).
2. **Conexão**: escopo OAuth `mcp:write`, concedido só por opção explícita na tela de consentimento. Tokens fixos (`rrf_mcp_`) nunca escrevem.
3. **Usuário**: permissões atuais da pessoa na loja (`finance.manage`, `integrations.sales.manage`), lidas do banco a cada chamada, mais a área de dados habilitada.

As ações reaproveitam os serviços da tela (`AccountsPayableService`, `SalesImportPreviewService` + `SalesImportRunProcessor`, `SalesImportConfirmationService`). Nenhuma regra de negócio é duplicada; as tools só resolvem nomes em ids, montam o DTO e formatam a resposta.

## Technical Context

**Language/Version**: TypeScript strict, Node.js 20 · **Dependencies**: NestJS 10, Prisma 5, Next.js 14, `@modelcontextprotocol/sdk` (nenhuma nova)

**Storage**: PostgreSQL. `store_mcp_configurations.actions_enabled`, `mcp_tool_calls.is_action`, `financial_audits.channel`, `sales_import_runs.channel` (texto curto, ex.: `MCP · Claude`)

**Testing**: Vitest. Unit (resolução de nomes, merge da edição, mapeamento de saídas), integração com módulo focado + Prisma em memória (padrão 025/026): matriz de autorização (SC-001), paridade tela × MCP para contas (SC-002) e importação (SC-003), consentimento OAuth com e sem ações; web (configuração do MCP e consentimento)

**Target Platform**: Render (API + web), PostgreSQL 18

**Constraints**: classes de serviço com `@Inject` explícito (Vitest sem metadata de decorators); respostas em português, valores em reais; nada de dados bancários nas respostas

## Constitution Check

- Multi-tenant: toda ação usa o `tenantId` do contexto MCP; ids recebidos são sempre buscados com o `tenantId` (já é assim nos serviços).
- Segurança: menor privilégio (três travas), revogação imediata, auditoria com usuário e canal.
- Sem duplicação de regra de negócio: tools chamam os mesmos serviços dos controllers.
- Testes antes do merge; docs (guia do usuário, contrato MCP) atualizados.

## Project Structure

```text
packages/database/prisma/
  schema.prisma                         # actionsEnabled, isAction, channel (x2)
  migrations/2026100410xxxx_mcp_write_actions/

apps/api/src/management/mcp/
  mcp-actions.ts                        # NOVO: MCP_WRITE_SCOPE, ACTION_PERMISSIONS, canUseActions()
  oauth/
    oauth-urls.ts                       # scopes_supported: mcp:read, mcp:write
    oauth-authorization.service.ts      # aceita mcp:write; consentimento decide; grava escopo
    oauth-authorize.controller.ts       # body do consentimento: allowActions
    oauth-credential.resolver.ts        # devolve scope + userId da conexão
    store-eligibility.ts                # permissionsForStore(userId, tenantId)
  server/
    mcp-context.ts                      # actions: { allowed, permissions } no contexto
    mcp-token.guard.ts                  # monta o contexto de ações (OAuth + loja + usuário)
    mcp-server.factory.ts               # registra tools de ação só quando permitidas; anotações
    mcp-tool-runner.ts                  # isAction no log; limite de ações por conexão
    mcp-action-actor.ts                 # NOVO: AuthUser sintético do usuário da conexão + canal
  tools/
    tool-output.ts                      # McpToolDefinition: kind "read" | "action", permission
    name-resolver.ts                    # NOVO: categoria/fornecedor/conta financeira/produto por nome
    payables-actions.tools.ts           # NOVO: criar/pagar/editar/cancelar
    sales-import.tools.ts               # NOVO: integracoes_de_vendas, previa, status, confirmar
    payables.tools.ts                   # contas_a_pagar devolve id
  admin/
    store-mcp-configuration.service.ts  # actionsEnabled + auditoria
    dto/                                # actionsEnabled no DTO

apps/api/src/management/financial/      # FinancialAuditService grava channel (opcional)
apps/api/src/management/sales-integrations/
  sales-import-preview.service.ts       # create(..., channel?)

apps/web/app/admin/settings/mcp/        # chave "Permitir ações pelos assistentes"; uso mostra ações
apps/web/app/conectar/mcp/              # opção de ações no consentimento
```

## Design

**Contexto de ações.** O guard já resolve a conexão OAuth. Passa a montar `context.actions = { allowed: boolean, permissions: string[], channel: string }`: `allowed` só quando a conexão tem `mcp:write`, a loja tem `actionsEnabled` e o usuário está ativo e alcança a loja; `permissions` vem de `StoreEligibilityService.permissionsForStore` (OWNER/ADMIN/master = todas). Tokens fixos: `allowed = false`.

**Registro das tools.** `McpToolDefinition` ganha `kind` (`read` padrão) e, para ações, `permission`. A fábrica registra uma ação só se `actions.allowed`, a área estiver habilitada e o usuário tiver a permissão; anotações `readOnlyHint: false`, `destructiveHint` (true só para cancelar), `idempotentHint` (true para confirmar e cancelar). A tool runner revalida tudo na chamada (defesa em profundidade para servidor stateless) e aplica limite de 30 ações/hora por conexão.

**Ator.** `McpActionActor` monta o `AuthUser` mínimo (id, tenantId, role, permissions) que os serviços esperam, a partir do usuário da conexão, e o canal `MCP · <cliente>`. A auditoria financeira e a execução de importação gravam `channel`.

**Contas a pagar.** `criar` resolve nomes, checa duplicidade (descrição normalizada + valor + vencimento, não cancelada) e chama `create`. `editar` lê a conta, aplica só os campos enviados sobre o estado atual e chama `update` (que já exige o DTO completo e mantém as regras). `pagar` e `cancelar` chamam `addPayment` e `cancel`.

**Importação.** `previa` resolve a integração (por provedor quando houver uma só ativa, ou por nome/id), valida período (até o limite da tela) e atribuição, chama `SalesImportPreviewService.create` com trigger `MANUAL` ou `INITIAL_LOAD` e canal, e enfileira a prévia. `status` usa `get` + resumo de contagens. `confirmar` só aceita `PREVIEW_READY`/`PARTIALLY_READY` e enfileira a confirmação (idempotente no processor).

**Consentimento.** A tela `/conectar/mcp` mostra a opção de ações (desmarcada) quando a loja permite e o usuário tem alguma permissão de ação, listando o que libera. O escopo concedido é `mcp:read` ou `mcp:read mcp:write`, independentemente do que o cliente pediu. Conexões existentes ficam como estão.

## Test Strategy

- **Matriz de autorização (SC-001)**: token fixo; OAuth sem `mcp:write`; loja sem ações; usuário sem permissão; área desligada; conexão revogada; tudo certo. Lista de tools e chamada direta.
- **Contas (SC-002)**: criar pela tool e pelo serviço com os mesmos dados → mesmas ocorrências e auditoria (com canal); nomes ambíguos; duplicidade; pagar parcial/total/excedente; editar parcial; cancelar com e sem pagamento.
- **Importação (SC-003)**: prévia → status → confirmar com processor fake; sobreposição; confirmação repetida; carga inicial só no Mercado Pago; iFood sem conciliação.
- **OAuth**: consentimento com e sem ações; cliente pedindo `mcp:write` sem a loja permitir → só leitura.
- **Web**: chave na configuração do MCP; opção no consentimento.

## Complexity Tracking

Sem violações. O maior risco é de segurança; por isso a revalidação a cada chamada e a matriz de testes da SC-001.
