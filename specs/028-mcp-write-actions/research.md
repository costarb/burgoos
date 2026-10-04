# Research: Ações pelo MCP

## R1. Situação atual (levantamento no código)

- MCP somente leitura: `MCP_OAUTH_SCOPE = "mcp:read"` (`oauth-urls.ts`), consentimento descrito como "Somente leitura dos numeros da loja", toda tool registrada com `readOnlyHint: true` (`mcp-server.factory.ts`).
- Contexto MCP (`mcp-context.ts`): `tenantId`, `tokenId` (token fixo) ou `connectionId` + `userId` (OAuth), `enabledAreas`.
- Token fixo (`StoreMcpToken`) só tem `createdByUserId`; não representa quem está conversando.
- Permissões da pessoa na loja já são calculadas pelo banco em `StoreEligibilityService` (OWNER/ADMIN/master liberados; demais pelo perfil da loja), usado para `mcp.connect`.
- Contas a pagar: `AccountsPayableService.create/update/cancel/addPayment(user: AuthUser, ...)`, todas auditadas em `FinancialAudit` com `actorUserId`. `update` exige o DTO completo.
- Importação: `SalesImportPreviewService.create(tenantId, userId, dto, trigger)` + `SalesImportRunProcessor.queuePreview/queueConfirmation`. DTO: `integrationId`, `startDate`, `endDate`, `strategy` (`PRICE_WEIGHTED`/`FIXED_PRODUCT`), `fixedProductId`. Mercado Pago tem `initialPeriodDays` 30/60/90 (`period()` em `mercado-pago-sync.controller.ts`). Estados: `PENDING`, `FETCHING`, `PREVIEW_READY`, `PARTIALLY_READY`, `IMPORTING`, `COMPLETED`, `COMPLETED_WITH_ERRORS`, `FAILED`, `CANCELLED`.

## R2. Por que só OAuth para escrever

Decisão do usuário. O token fixo é um segredo de longa duração colado em arquivos de configuração; se vazar, permitiria alterar dados sem identificar a pessoa. A conexão OAuth é de um usuário, expira, é revogável na tela e permite conferir as permissões dele a cada chamada.

## R3. Escopo e consentimento

- Clientes MCP leem `scopes_supported` e costumam pedir todos ou nenhum. Por isso o **consentimento decide**: o escopo gravado é `mcp:read` ou `mcp:read mcp:write` conforme a opção marcada pelo usuário, não conforme o pedido do cliente.
- Pedido de `mcp:write` com a loja sem ações: concede só leitura (não é erro), avisando na tela.
- Conexões existentes ficam `mcp:read`; para ações, o usuário reconecta.

## R4. Revalidação a cada chamada

O servidor MCP é stateless (uma instância por requisição); a lista de tools pode ter sido obtida antes de uma mudança. A tool runner revalida loja, conexão, escopo, área e permissão em toda chamada de ação.

## R5. Identificação por nome

`contas_a_pagar` já resolve categorias e fornecedores por nome (sem maiúsculas/acentos) com erro `INVALID_FILTER` listando opções. O mesmo resolvedor é extraído e estendido para conta financeira (pagamento) e produto (atribuição fixa). Ambíguo = erro com as opções.

## R6. Duplicidade

Na criação: mesma descrição (normalizada), mesmo valor e mesmo vencimento, não cancelada → não cria, devolve a existente e pede `confirmarDuplicidade: true`. Protege contra repetição de chamada pelo assistente.

## R7. Canal de origem

`FinancialAudit` e `SalesImportRun` não registram a origem. Coluna nova `channel` (texto, opcional): nulo = tela; `MCP · <cliente>` = assistente. O uso do MCP (`McpToolCall`) ganha `isAction` para filtrar na tela de uso.

## R8. Limites

Além do limite geral do MCP, 30 ações por conexão por hora, contadas em `McpToolCall` (`isAction`, `connectionId`, última hora).
