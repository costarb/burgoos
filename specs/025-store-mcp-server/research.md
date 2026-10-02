# Research: MCP Server por Loja

**Feature**: `025-store-mcp-server` | **Date**: 2026-10-01

## R1. Biblioteca do protocolo MCP

- **Decision**: `@modelcontextprotocol/sdk` (versão atual 1.31.x), usando `McpServer` (`server/mcp.js`) e `StreamableHTTPServerTransport` (`server/streamableHttp.js`), mais `zod` (peer dependency, `^3.25`) para os schemas de entrada das tools.
- **Rationale**: SDK oficial, implementa a especificação atual (tools, resources, prompts, Streamable HTTP). Publica build CommonJS (`exports.require → dist/cjs`) e `typesVersions`, então funciona com o `module: CommonJS` / `moduleResolution: Node` de `apps/api/tsconfig.json` sem mudar a configuração de build. Requer Node ≥ 18 (projeto usa 20).
- **Alternatives considered**: implementar JSON-RPC à mão (rejeitado: reimplementar negociação de capabilities, paginação e validação é caro e frágil); `@rekog/mcp-nest` ou similares (rejeitado: dependência extra de terceiros sobre o SDK, com menos controle do ciclo de vida e da autenticação).

## R2. Transporte e integração com NestJS / Express 4

- **Decision**: Streamable HTTP em modo **stateless** (`sessionIdGenerator: undefined`, `enableJsonResponse: true`), com um controller Nest `POST /api/mcp` que, a cada requisição, cria um `McpServer` com as tools da loja resolvida pelo token, cria um transport, chama `transport.handleRequest(req, res, req.body)` e fecha ambos quando a resposta termina. `GET` e `DELETE /api/mcp` respondem `405`.
- **Rationale**:
  - O SDK depende de Express 5 internamente, mas `handleRequest` trabalha sobre `IncomingMessage`/`ServerResponse` do Node, que o Express 4 do Nest fornece. O body já chega parseado pelo `json()` global de `main.ts`.
  - Stateless elimina estado em memória entre requisições (o ambiente roda com memória limitada, `--max-old-space-size=384`) e garante que revogar o token, desabilitar o MCP ou mudar as áreas vale **na próxima chamada** (FR-006, edge case "troca de configuração durante uma sessão").
  - Construir o servidor por requisição permite registrar **apenas** as tools das áreas liberadas (FR-013). O custo é baixo: são cerca de 10 registros de função.
  - JSON response (sem SSE) simplifica proxies e o Render, e as tools não fazem streaming.
- **Alternatives considered**: sessões stateful com `Mcp-Session-Id` (rejeitado: estado em memória, problema com múltiplas instâncias, invalidação de sessão ao revogar); transporte SSE legado (rejeitado: obsoleto na especificação); stdio (rejeitado: exigiria um pacote local instalado na máquina do usuário).

## R3. Autenticação por token de loja

- **Decision**: token opaco `rrf_mcp_<43 chars base64url>` (32 bytes de `crypto.randomBytes`). Armazenar `SHA-256(token)` em hex (`tokenHash`, único) e o prefixo visível (`rrf_mcp_` + 6 primeiros caracteres). Validação por lookup do hash, seguida de checagem de revogação, expiração, `StoreMcpConfiguration.enabled` e `Tenant.active`. Guard dedicado `McpTokenGuard`, desacoplado de `JwtAuthGuard`.
- **Rationale**: 256 bits de entropia tornam desnecessário um hash lento (bcrypt) e permitem lookup O(1) por índice único. O lookup por hash evita comparação de strings sensível a timing. O prefixo `rrf_mcp_` permite que scanners de segredo (GitHub secret scanning, por exemplo) identifiquem tokens vazados. Todas as falhas retornam o mesmo `401` genérico (FR-012). O endpoint fica fora de `/api/admin`, então a regra do `JwtAuthGuard` que bloqueia platform admin não se aplica e não há conflito.
- **Alternatives considered**: reutilizar o JWT de sessão (rejeitado: expira, carrega o usuário e não a loja, e não pode ser revogado individualmente); JWT de longa duração assinado (rejeitado: revogação exige lista negra, o que equivale a consultar o banco do mesmo jeito); OAuth 2.1 (adiado para a fase 2, ver spec).

## R4. Reaproveitamento dos cálculos existentes (FR-017)

- **Decision**: as tools chamam diretamente os services já usados pelos controllers do admin, aplicando o mesmo parsing de período:

| Tool | Service / método | Parsing de período |
|---|---|---|
| `resumo_vendas` | `SalesReportService.getReport(tenantId, parsed)` | `parseSalesReportQuery` |
| `resumo_diario` | `ReportsService.getDailySummary(tenantId, date)` | data `YYYY-MM-DD` |
| `relatorio_gerencial` | `ManagementReportService.getReport(tenantId, parsed)` | `parseManagementReportQuery` |
| `dre` | `DreService.getSummary(tenantId, start, end)` | `localDayStart/localDayEnd`, padrão mês corrente |
| `dashboard_financeiro` | `FinancialDashboardService.getIndicators(tenantId)` | sem período (mês corrente) |
| `engenharia_cardapio` | `MenuEngineeringService.getReport(tenantId, start, end)` | igual ao controller |
| `posicao_caixa` | `CashFlowService.getPosition(tenantId, asOf, projectionEnd)` | padrão hoje + 30 dias |
| `extrato_caixa` | `CashFlowService.getStatement(tenantId, start, end)` | padrão últimos 30 dias |
| `contas_a_pagar` | `AccountsPayableService.list(tenantId, query)` | `start/end/status` |
| `estoque` | `InventoryService.listBalances(tenantId)` | sem período |

  As funções locais de parsing de data hoje duplicadas nos controllers (`parseDate`, `endOfDay`, `firstDayOfCurrentMonth`) passam a ser extraídas para um utilitário compartilhado de período, usado pelos controllers e pelas tools. Assim, "mesmos parâmetros → mesmos números" fica garantido por construção.
- **Rationale**: uma única fonte de cálculo. Os testes de paridade comparam a saída da tool com a saída do service para os mesmos parâmetros.
- **Alternatives considered**: consultas SQL próprias para o MCP (rejeitado: divergência garantida com o tempo); chamar os endpoints REST internamente via HTTP (rejeitado: overhead e acoplamento ao JWT).
- **Fora desta fase**: lucratividade por pedido (`OrderProfitabilityService` só grava snapshots e não tem leitura por loja; a análise de margem fica coberta por engenharia de cardápio e DRE).

## R5. Formato das respostas e privacidade (FR-018, FR-019)

- **Decision**: cada tool passa a saída do service por um **mapper explícito** (allow-list de campos), que produz um JSON compacto com:
  - `periodo: { inicio, fim, fuso: "America/Sao_Paulo" }`, sempre presente quando aplicável (FR-020);
  - valores monetários como número com 2 casas e o campo nomeado com sufixo `Reais` (ex.: `faturamentoReais`), para evitar ambiguidade de centavos;
  - listas truncadas em 50 itens, com `truncado: true` e `totalItens` (FR-018);
  - `semMovimento: true` quando os totais são zero.

  O retorno MCP usa `structuredContent` (JSON) e um bloco `text` com o mesmo JSON serializado, para clientes que não leem conteúdo estruturado. Um teste automatizado percorre todas as respostas procurando chaves proibidas (`customer`, `phone`, `address`, `document`, `cpf`, `email`, `token`, `secret`) e reaproveita a regex de `IntegrationSecretService.redact` como rede de segurança.
- **Rationale**: allow-list é mais segura que deny-list. Os relatórios de vendas e o gerencial podem carregar dados de pedido; o mapper descarta qualquer campo não previsto. Agregados prontos reduzem erro de aritmética do LLM.
- **Alternatives considered**: devolver a saída crua do service (rejeitado: risco de PII e payload grande); redaction genérica apenas (rejeitado: deny-list falha aberta).

## R6. Limite de taxa por token (FR-015)

- **Decision**: estender `FixedWindowRateLimitGuard` com um método protegido `bucketKey(request)` (padrão atual: IP). `McpRateLimitGuard` sobrescreve para usar o id do token resolvido pelo `McpTokenGuard` e usa `limit` vindo de `MCP_RATE_LIMIT_PER_MINUTE` (padrão 60). Ao exceder, retorna `429` com a mensagem em português já usada.
- **Rationale**: reaproveita o guard existente com uma mudança mínima e compatível com os usos atuais. Bucket em memória é aceitável no MVP (uma instância de API).
- **Alternatives considered**: rate limit em banco ou Redis (rejeitado no MVP por custo; reavaliar ao escalar horizontalmente).

## R7. Proteção de memória e timeout

- **Decision**: antes de executar uma tool, consultar `MemoryPressureService`. Em nível `HIGH`/`PEAK`, recusar com erro amigável ("Sistema sob carga, tente um período menor ou aguarde"). Cada execução tem timeout de 20s (`MCP_TOOL_TIMEOUT_MS`), com erro amigável ao estourar. Períodos acima de 92 dias são recusados via `assertInteractivePeriod`.
- **Rationale**: reaproveita a observabilidade existente (feature 018) e evita que consultas de LLM, potencialmente em rajada, derrubem o processo da API.

## R8. Auditoria e log de uso

- **Decision**:
  - Mudanças de configuração e tokens: `AccessAuditService.record` com novos valores em `AccessAuditEventType` (`MCP_CONFIGURATION_CHANGED`, `MCP_TOKEN_CREATED`, `MCP_TOKEN_REVOKED`), aparecendo na tela de auditoria de acessos já existente (FR-009).
  - Chamadas de tools: nova tabela `mcp_tool_calls` (FR-024), gravada em modo fire-and-forget após a resposta, com parâmetros saneados (apenas os argumentos declarados da tool, truncados em 1 KB). Recusas são gravadas apenas quando o token é conhecido (hash encontrado), para não permitir encher o log com tokens aleatórios.
  - `lastUsedAt` do token é atualizado com throttle (no máximo 1 escrita por minuto por token) para não gerar uma escrita por chamada (FR-025).
  - Retenção: cron diário no papel `worker`/`all` (`RuntimeRoleService`) apaga registros com mais de 90 dias em lotes de `RETENTION_BATCH_SIZE` (FR-026).
- **Alternatives considered**: reaproveitar `AccessAuditEvent` para as chamadas (rejeitado: volume alto poluiria a auditoria de acesso e o índice).

## R9. Endereço público do servidor nos trechos de configuração (FR-008)

- **Decision**: nova variável `MCP_PUBLIC_URL` (ex.: `https://api.rrfive.com.br/api/mcp`). Se ausente, a API deriva o endereço de `req.protocol`/`host` + `/api/mcp`. A tela recebe o endereço pronto do endpoint de configuração e monta os trechos para Inspector, Claude Code, Claude Desktop (`mcp-remote`) e Cursor.

## R10. Desvios em relação à constituição

- "AI assistant" está em *Explicitly Deferred* no MVP. Esta spec promove explicitamente o item, como a governança permite ("post-MVP unless a new specification promotes them"). Não há assistente embutido: o RRFive OS apenas expõe dados somente leitura para um cliente externo.
- "API: REST with OpenAPI": o endpoint `/api/mcp` segue o protocolo MCP (JSON-RPC 2.0 sobre HTTP), padrão exigido pelos clientes. Os endpoints de configuração no admin continuam REST com OpenAPI. Os contratos das tools ficam documentados em `contracts/mcp-tools.md`.
