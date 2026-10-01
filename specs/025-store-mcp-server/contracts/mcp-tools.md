# Contrato MCP: Tools, Resources e Prompts

**Feature**: `025-store-mcp-server` | **Endpoint**: `POST /api/mcp` | **Protocolo**: MCP (JSON-RPC 2.0), transporte Streamable HTTP, modo stateless, respostas `application/json`

## Transporte e autenticação

| Item | Valor |
|---|---|
| Endpoint | `POST {MCP_PUBLIC_URL}` (padrão `/api/mcp`) |
| Header obrigatório | `Authorization: Bearer rrf_mcp_<token>` |
| Headers do cliente | `Content-Type: application/json`, `Accept: application/json, text/event-stream` |
| `GET` / `DELETE /api/mcp` | `405 Method Not Allowed` |
| Server info | `{ name: "rrfive-os", version: "<versão da API>" }`, `instructions` em português com o nome da loja e o fuso |
| Capabilities | `tools`, `resources`, `prompts` (sem `listChanged`, porque o servidor é stateless) |

### Respostas HTTP de recusa (antes do JSON-RPC)

| Situação | HTTP | Corpo |
|---|---|---|
| Token ausente, malformado, desconhecido, revogado, expirado; MCP desabilitado; loja inativa | `401` | `{ "error": "unauthorized", "message": "Token MCP invalido ou sem acesso." }` + `WWW-Authenticate: Bearer` |
| Limite de taxa excedido | `429` | `{ "statusCode": 429, "code": "RATE_LIMITED", "message": "Muitas requisicoes. Tente novamente em instantes.", "retryAfterSeconds": n }` |

### Erros dentro de uma tool

Erros de negócio retornam resultado de tool com `isError: true` e um bloco `text` em português (o LLM consegue ler e corrigir os parâmetros). Códigos (também gravados em `McpToolCall.errorCode`):

| Código | Mensagem |
|---|---|
| `INVALID_PERIOD` | "Periodo invalido: a data inicial deve ser anterior ou igual a final, no formato AAAA-MM-DD." |
| `PERIOD_TOO_LONG` | "O periodo maximo por consulta e de 92 dias. Divida a analise em periodos menores." |
| `AREA_DISABLED` | "A area de dados <área> nao esta liberada para esta loja." |
| `TIMEOUT` | "A consulta demorou demais. Tente um periodo menor." |
| `MEMORY_PRESSURE` | "O sistema esta sob carga no momento. Aguarde alguns instantes ou use um periodo menor." |
| `INTERNAL` | "Nao foi possivel concluir a consulta." (detalhe só no log do servidor) |

`AREA_DISABLED` ocorre apenas se o cliente chamar uma tool que não estava na listagem, já que tools de áreas desligadas não são registradas.

## Convenções de saída (todas as tools)

- Retorno com `structuredContent` (objeto JSON) e `content: [{ type: "text", text: JSON.stringify(structuredContent) }]`.
- `periodo: { inicio: "AAAA-MM-DD", fim: "AAAA-MM-DD", fuso: "America/Sao_Paulo", padraoAplicado: boolean }` em toda tool que usa período.
- Valores monetários: `number` com 2 casas, campos com sufixo `Reais`. Percentuais: `number` de 0 a 100 com 1 casa, sufixo `Percentual`.
- Listas: no máximo 50 itens, acompanhadas de `totalItens` e `truncado`.
- `semMovimento: true` quando não há dados no período.
- **Nunca** incluir nome, telefone, endereço, documento ou e-mail de cliente, nem segredos de integração.

Parâmetros de data: string `AAAA-MM-DD`. Os schemas abaixo usam notação zod simplificada.

## Tools

### Área `SALES`

#### `resumo_vendas`
> Resumo de vendas da loja no período: faturamento, pedidos, ticket médio e quebras por dia, plataforma, meio de pagamento e status. Mesmos números da tela Relatório de Vendas.

```ts
{
  inicio?: string,             // padrão: janela móvel de 31 dias da tela
  fim?: string,
  plataformas?: string[],      // ids de plataforma (ver recurso perfil_loja)
  meiosPagamento?: ("CASH"|"PIX_MANUAL"|"CARD_ON_DELIVERY"|"DEBIT_CARD"|"CREDIT_CARD"|"VOUCHER"|"PIX"|"DIGITAL_WALLET")[],
  instituicoes?: ("PAGBANK"|"MERCADO_PAGO"|"IFOOD"|"DINHEIRO"|"CAIXA_LOCAL")[],
  status?: ("PENDING"|"PREPARING"|"READY"|"SHIPPED"|"DELIVERED"|"CANCELLED")[]
}
```
Saída: `periodo`, `totais { faturamentoReais, pedidos, ticketMedioReais, descontosReais, taxasReais, liquidoReais }`, `porDia[] { data, faturamentoReais, pedidos }`, `porPlataforma[] { plataforma, faturamentoReais, pedidos, participacaoPercentual }`, `porMeioPagamento[] {...}`, `porStatus[] {...}`, `semMovimento`. Sem lista de pedidos individuais.
Fonte: `parseSalesReportQuery` + `SalesReportService.getReport`.

#### `resumo_diario`
> Resumo operacional de um dia: pedidos e faturamento bruto.

```ts
{ data?: string }              // padrão: hoje
```
Saída: `data`, `pedidos`, `faturamentoBrutoReais`, mais quebras disponíveis no service. Fonte: `ReportsService.getDailySummary`.

#### `relatorio_gerencial`
> Visão gerencial consolidada do período (vendas, custos e resultado), igual à tela Relatório Gerencial.

```ts
{ inicio?: string, fim?: string }
```
Fonte: `parseManagementReportQuery` + `ManagementReportService.getReport`. O mapper mantém só agregados.

### Área `FINANCIAL`

#### `dre`
> DRE (Demonstração do Resultado) do período: receita bruta, deduções, CMV, margem de contribuição, despesas fixas e resultado líquido.

```ts
{ inicio?: string, fim?: string }   // padrão: mês corrente
```
Saída: `periodo`, linhas da DRE em `Reais` e `Percentual` sobre a receita. Fonte: `DreService.getSummary`.

#### `dashboard_financeiro`
> Indicadores financeiros do mês corrente: resultado, CMV, produtos com preço a revisar, ingredientes ativos e pedidos entregues.

```ts
{}
```
Fonte: `FinancialDashboardService.getIndicators`.

### Área `MENU`

#### `engenharia_cardapio`
> Engenharia de cardápio do período: cada produto classificado por popularidade e margem (STAR = estrela, WORKHORSE = burro de carga, PUZZLE = quebra-cabeça, DOG = cão), com quantidade vendida e margem unitária.

```ts
{ inicio?: string, fim?: string, classificacao?: ("STAR"|"WORKHORSE"|"PUZZLE"|"DOG")[] }
```
Saída: `periodo`, `medias { popularidade, margemReais }`, `produtos[]` (até 50, ordenados por faturamento) `{ produto, categoria, quantidade, faturamentoReais, margemUnitariaReais, margemPercentual, classificacao }`, `contagemPorClassificacao`. Fonte: `MenuEngineeringService.getReport`.

### Área `CASH`

#### `posicao_caixa`
> Saldo atual por conta financeira e projeção de entradas e saídas até a data informada.

```ts
{ dataReferencia?: string, projecaoAte?: string }   // padrão: hoje e hoje + 30 dias; projeção máx. 92 dias
```
Fonte: `CashFlowService.getPosition`. O `ledger` detalhado é omitido; mantém saldos por conta e totais projetados por dia/semana.

#### `extrato_caixa`
> Entradas e saídas consolidadas do período, por categoria e por conta.

```ts
{ inicio?: string, fim?: string }   // padrão: últimos 30 dias
```
Fonte: `CashFlowService.getStatement`. Movimentos individuais são agregados por categoria/dia. Descrições livres não são expostas.

### Área `PAYABLES`

#### `contas_a_pagar`
> Contas a pagar por situação, com totais: vencidas, em aberto, parcialmente pagas e pagas, por vencimento no período.

```ts
{
  inicio?: string, fim?: string,     // filtro por vencimento; padrão: hoje-30 até hoje+30
  status?: ("OPEN"|"PARTIALLY_PAID"|"OVERDUE"|"PAID"|"CANCELLED")[]
}
```
Saída: `periodo`, `totais { previstoReais, pagoReais, restanteReais, vencidoReais }`, `porCategoria[]`, `porFornecedor[]` (nome do fornecedor, pessoa jurídica), `contas[]` (até 50) `{ descricao, fornecedor, categoria, vencimento, valorReais, restanteReais, status }`. Fonte: `AccountsPayableService.list` com `pageSize` 50. Dados bancários e documentos do fornecedor nunca são incluídos.

### Área `INVENTORY`

#### `estoque`
> Posição de estoque de ingredientes: saldo estimado, mínimo e situação (OK, comprar, insuficiente).

```ts
{ situacao?: ("OK"|"BUY"|"INSUFFICIENT")[] }
```
Saída: `totais { ingredientes, ok, comprar, insuficiente }`, `itens[]` (até 50, críticos primeiro) `{ ingrediente, saldoEstimado, estoqueMinimo, situacao }`. Fonte: `InventoryService.listBalances`.

## Resources

| URI | Nome | Conteúdo |
|---|---|---|
| `rrfive://loja/perfil` | `perfil_loja` | `{ nome, slug, fuso: "America/Sao_Paulo", plataformas[] { id, nome }, meiosPagamento[], instituicoes[], areasLiberadas[] }` |
| `rrfive://glossario` | `glossario_metricas` | Markdown em português: faturamento, ticket médio, CMV, margem de contribuição, resultado líquido, classificação de engenharia de cardápio, status de contas a pagar, situação de estoque, regras de período (máx. 92 dias, fuso) |

## Prompts

| Nome | Argumentos | Áreas exigidas | Orientação gerada |
|---|---|---|---|
| `analise_semanal` | `semanaTerminandoEm?: string` | `SALES` | Comparar a semana com a anterior: faturamento, pedidos, ticket, plataformas e dias. Apontar 3 destaques e 3 pontos de atenção |
| `comparar_periodos` | `inicioA, fimA, inicioB, fimB` | `SALES`, `FINANCIAL` | Comparar vendas e DRE entre os dois períodos, com variação absoluta e percentual, e explicar as causas prováveis |
| `diagnostico_margem_cardapio` | `inicio?, fim?` | `MENU` | Usar a engenharia de cardápio para sugerir ações por classificação (reprecificar, promover, revisar ficha técnica, retirar) |
| `saude_caixa_30_dias` | (nenhum) | `CASH`, `PAYABLES` | Cruzar a posição de caixa projetada com as contas a vencer e apontar dias de risco de saldo negativo |

Os prompts só orientam o LLM sobre quais tools chamar e como estruturar a análise. Eles não carregam dados.
