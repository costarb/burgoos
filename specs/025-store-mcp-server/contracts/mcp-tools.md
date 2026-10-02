# Contrato MCP: Tools, Resources e Prompts

**Feature**: `025-store-mcp-server` | **Endpoint**: `POST /api/mcp` | **Protocolo**: MCP (JSON-RPC 2.0), transporte Streamable HTTP, modo stateless, respostas `application/json`

## Transporte e autenticação

| Item | Valor |
|---|---|
| Endpoint | `POST {MCP_PUBLIC_URL}` (padrão `/api/mcp`) |
| Header obrigatório | `Authorization: Bearer rrf_mcp_<token>` |
| Headers do cliente | `Content-Type: application/json`, `Accept: application/json, text/event-stream` |
| `GET` / `DELETE /api/mcp` | `405 Method Not Allowed` (`Allow: POST`) |
| Server info | `{ name: "rrfive-os", version: "0.1.0" }`, `instructions` em português com o nome da loja, as áreas liberadas e as regras de período |
| Capabilities | `tools`, `resources`, `prompts` |
| Anotações das tools | `readOnlyHint: true`, `idempotentHint: true`, `openWorldHint: false` |

### Respostas HTTP de recusa (antes do JSON-RPC)

| Situação | HTTP | Corpo |
|---|---|---|
| Token ausente, malformado, desconhecido, revogado, expirado; MCP desabilitado; loja inativa | `401` | `{ "error": "unauthorized", "message": "Token MCP invalido ou sem acesso." }` + `WWW-Authenticate: Bearer realm="rrfive-mcp"` |
| Limite de taxa excedido (por token) | `429` | `{ "statusCode": 429, "code": "RATE_LIMITED", "message": "Muitas requisicoes. Tente novamente em instantes.", "retryAfterSeconds": n }` |

Recusas de tokens **conhecidos** (revogado, expirado, MCP desabilitado, loja inativa, limite de taxa) são gravadas no log de uso com `result = DENIED` e o motivo em `errorCode`. Tokens desconhecidos ou malformados não geram registro.

### Erros dentro de uma tool

Erros de negócio retornam resultado de tool com `isError: true` e um bloco `text` em português (o LLM consegue ler e corrigir os parâmetros). Os códigos também ficam em `McpToolCall.errorCode`:

| Código | Mensagem |
|---|---|
| `INVALID_PERIOD` | "Periodo invalido: a data inicial deve ser anterior ou igual a final, no formato AAAA-MM-DD." |
| `INVALID_FILTER` | "Categoria nao encontrada: <nome>. Opcoes: <lista>." (idem para fornecedor) |
| `PERIOD_TOO_LONG` | "O periodo maximo por consulta e de 92 dias. Divida a analise em periodos menores." |
| `AREA_DISABLED` | "A area de dados <área> nao esta liberada para esta loja." |
| `TIMEOUT` | "A consulta demorou demais. Tente um periodo menor." |
| `MEMORY_PRESSURE` | "O sistema esta sob carga no momento. Aguarde alguns instantes ou use um periodo menor." |
| `INTERNAL` | "Nao foi possivel concluir a consulta." (detalhe só no log do servidor) |

Tools de áreas desligadas não são registradas: não aparecem em `tools/list`. Uma chamada direta a uma delas recebe `AREA_DISABLED`. Argumentos fora do schema (formato de data, valores de enum) são recusados pelo próprio SDK com erro de validação.

## Convenções de saída (todas as tools)

- Retorno com `structuredContent` (objeto JSON) e `content: [{ type: "text", text: JSON.stringify(structuredContent) }]`.
- `periodo: { inicio, fim, fuso: "America/Sao_Paulo", padraoAplicado }` em toda tool com período. `padraoAplicado = true` quando nenhuma data foi informada.
- Valores monetários: `number` com 2 casas, sufixo `Reais`. Percentuais: `number` de 0 a 100 com 1 casa, sufixo `Percentual`.
- Listas de entidades (produtos, contas, itens de estoque, categorias): no máximo 50 itens, com `totalItens` e `truncado`. Séries diárias são limitadas pelo próprio período (máximo de 92 dias).
- `semMovimento: true` quando não há dados no período.
- **Nunca** incluir nome, telefone, endereço, documento ou e-mail de cliente, observações/documentos de contas, dados bancários, nem segredos de integração (mappers com lista de campos permitidos).

Parâmetros de data: string `AAAA-MM-DD`.

## Tools

### Área `SALES`

#### `resumo_vendas`
Entrada: `inicio?`, `fim?` (padrão: últimos 31 dias, como a tela), `plataformas?: uuid[]`, `meiosPagamento?: PaymentMethod[]`, `instituicoes?: PaymentInstitution[]`, `status?: OrderStatus[]` (padrão: apenas `DELIVERED`).

Saída: `periodo`, `filtros`, `totais { pedidos, faturamentoBrutoReais, receitaLiquidaReais, liberadoReais, aReceberReais, taxasPagamentoReais, ticketMedioReais }`, `porDia[] { data, pedidos, faturamentoBrutoReais, receitaLiquidaReais }`, `porPlataforma[] { plataformaId, plataforma, pedidos, faturamentoBrutoReais, receitaLiquidaReais, ticketMedioReais, participacaoPercentual }`, `porMeioPagamento[] { meioPagamento, rotulo, pedidos, faturamentoBrutoReais, participacaoPercentual }`, `porInstituicao[] { instituicao, rotulo, pedidos, faturamentoBrutoReais, taxasPagamentoReais, participacaoPercentual }`, `recebiveis { pedidosPendentes, valorReais, proximaLiberacao }`, `ifoodFinanceiro { vendas, valorSacolaReais, pagoPeloClienteReais, aReceberDoIfoodReais, recebidoPelaLojaReais }`, `semMovimento`. Sem pedidos individuais.

Fonte: `parseSalesReportQuery` + `SalesReportService.getReport` (com `pageSize = 1`; a lista analítica é descartada).

#### `resumo_diario`
Entrada: `data?` (padrão: hoje no fuso da loja). Saída: `data`, `fuso`, `pedidos`, `faturamentoBrutoReais`, `semMovimento`. Fonte: `ReportsService.getDailySummary`.

#### `relatorio_gerencial`
Entrada: `inicio?`, `fim?` (padrão: últimos 31 dias). Saída: `periodo`, `resumoExecutivo { faturamentoBrutoReais, receitaLiquidaReais, caixaLiquidoReais, saldoFinalReais, contasEmAbertoReais, contasVencidasReais, aReceberReais }`, `vendas { pedidos, faturamentoBrutoReais, receitaLiquidaReais, liberadoReais, aReceberReais, taxasReais, ticketMedioReais }`, `caixa { entradasReais, saidasReais, liquidoReais, saldoFinalReais, saldosPorConta[] { conta, saldoReais } }`, `contasAPagar { previstoReais, pagoReais, abertoReais, vencidoReais, quantidadeAbertas, quantidadeVencidas, porCategoria[] }`, `semMovimento`.

Fonte: `parseManagementReportQuery` + `ManagementReportService.getReport`.

### Área `FINANCIAL`

#### `dre`
Entrada: `mesCompetencia?: "AAAA-MM"` (padrão: mês corrente no fuso da loja). Legado: `inicio?`/`fim?` viram o mês de `inicio`, e a saída traz `observacao` explicando (spec 027).

Saída: `mesCompetencia`, `periodo { inicio, fim, fuso, padraoAplicado }`, `observacao?`, `receitaBrutaReais`, `descontosReais`, `receitaLiquidaReais`, `receitaLiquidaAdquirenteReais`, `cmvReais`, `cmvPercentual`, `taxasEImpostosReais`, `lucroBrutoReais`, `margemContribuicaoPercentual`, `despesasVariaveisReais`, `custosFixosReais` (`despesasFixasReais` mantido como alias), `lucroLiquidoEstimadoReais`, `margemLiquidaPercentual`, `pontoEquilibrioReais` (`null` quando não atingível), `pontoEquilibrioAtingivel`, `custoFixoPrevistoReais` (referência da configuração, fora do resultado), `diferencaCustoFixoReais` (lançado − previsto), `despesasPorCategoria[] { categoria, classificacao: "FIXED_COST"|"VARIABLE_EXPENSE", valorReais, quantidade }`, `semMovimento`. Percentuais calculados sobre a receita líquida.

Fonte: `DreService.getMonthlySummary` (o mesmo da tela DRE e do dashboard): vendas entregues do mês e contas a pagar não canceladas com `COALESCE(competência, vencimento)` no mês, pela classificação efetiva (`ajuste da conta` ou `classificação da categoria`; `EXCLUDED` fica fora). Como a tela, o service cria a configuração financeira padrão da loja se ela ainda não existir.

#### `dashboard_financeiro`
Entrada: nenhuma. Saída: `mesReferencia`, `faturamentoBrutoReais`, `cmvReais`, `lucroBrutoReais`, `lucroLiquidoEstimadoReais`, `margemLiquidaPercentual`, `pedidosEntregues`, `produtosComPrecoARevisar`, `ingredientesEmAlerta`, `semMovimento`. Fonte: `FinancialDashboardService.getIndicators`.

### Área `MENU`

#### `engenharia_cardapio`
Entrada: `inicio?`, `fim?` (padrão: mês corrente), `classificacao?: ("STAR"|"WORKHORSE"|"PUZZLE"|"DOG")[]`. Classificações: STAR = estrela, WORKHORSE = burro de carga, PUZZLE = quebra-cabeça, DOG = cão.

Saída: `periodo`, `dadosInsuficientes`, `medias { volumeMedio, margemMediaPercentual }`, `contagemPorClassificacao`, `produtos[]` (até 50, por faturamento) `{ produto, quantidade, faturamentoReais, cmvReais, lucroBrutoReais, margemPercentual, classificacao }`, `totalItens`, `truncado`, `semMovimento`.

Fonte: `MenuEngineeringService.getReport`.

### Área `CASH`

#### `posicao_caixa`
Entrada: `dataReferencia?` (padrão: agora), `projecaoAte?` (padrão: referência + 30 dias; máximo de 92 dias). Saída: `dataReferencia`, `projecaoAte`, `fuso`, `padraoAplicado`, `saldoAtualReais`, `entradasPrevistasReais`, `saidasPrevistasReais`, `saldoProjetadoReais`, `saldoNegativoPrevisto`, `contas[] { conta, saldoReais, naoAlocado }`, `projecaoDiaria[] { data, entradasReais, saidasReais, liquidoReais, saldoProjetadoReais }`.

Fonte: `CashFlowService.getPosition`. O `ledger`, a projeção por lançamento e as descrições livres são omitidos.

#### `extrato_caixa`
Entrada: `inicio?`, `fim?` (padrão: últimos 30 dias, como a tela). Saída: `periodo`, `saldoInicialReais`, `saldoFinalReais`, `entradasReais`, `saidasReais`, `liquidoReais`, `porDia[] { data, entradasReais, saidasReais, liquidoReais, saldoReais }`, `porOrigem[] { origem, rotulo, entradasReais, saidasReais }` (origens: `ORDER_RECEIPT`, `PAYABLE_PAYMENT`, `CASH_MOVEMENT`, `OPENING_BALANCE`), `semMovimento`.

Fonte: `CashFlowService.getStatement`. Lançamentos individuais e descrições não são expostos.

### Área `PAYABLES`

#### `contas_a_pagar`
Entrada (todos os filtros são opcionais, como na tela de contas a pagar):
- `inicio?`, `fim?`: vencimento (`AAAA-MM-DD`). Pode informar só um dos lados; com os dois, máximo de 92 dias.
- `status?: ("OPEN"|"PARTIALLY_PAID"|"OVERDUE"|"PAID"|"CANCELLED")[]`.
- `categorias?: string[]` e `fornecedores?: string[]`: nomes (sem diferenciar maiúsculas e acentos) ou ids. Um nome desconhecido gera o erro `INVALID_FILTER`, com a lista de opções válidas da loja.
- `mesCompetencia?`: `AAAA-MM`.

Sem nenhuma data de vencimento e sem `mesCompetencia`, aplica a janela padrão de vencimento (hoje − 30 até hoje + 30 dias).

Saída: `periodo { inicio|null, fim|null, fuso, criterio: "vencimento", padraoAplicado }`, `filtros { status, categorias, fornecedores, mesCompetencia }`, `totais { previstoReais, pagoReais, restanteReais, vencidoReais, quantidadeAbertas, quantidadeVencidas }`, `porCategoria[] { categoria, previstoReais, pagoReais, abertoReais, vencidoReais }`, `contas[]` (até 50, por vencimento) `{ descricao, fornecedor, categoria, competencia, classificacaoDre, classificacaoAjustada, vencimento, valorReais, pagoReais, restanteReais, status }` (`classificacaoDre`: `FIXED_COST|VARIABLE_EXPENSE|EXCLUDED`; `classificacaoAjustada`: a conta sobrescreve a categoria), `totalItens`, `truncado`, `semMovimento`. Totais, quebra por categoria e lista respeitam os mesmos filtros.

Fonte: `AccountsPayableService.list` (página 1, 50 itens), `summarizeByCategory` e `getOptions` (resolução de nomes). Observações, referência de documento e pagamentos (contas bancárias) nunca são incluídos.

### Área `INVENTORY`

#### `estoque`
Entrada: `situacao?: ("OK"|"BUY"|"INSUFFICIENT")[]`. Saída: `totais { ingredientes, ok, comprar, insuficiente }`, `itens[]` (até 50, críticos primeiro) `{ ingrediente, saldoEstimado, estoqueMinimo, consumidoOuReservado, situacao }`, `totalItens`, `truncado`, `semMovimento`.

Fonte: `InventoryService.listBalances`.

## Resources

| URI | Nome | Conteúdo |
|---|---|---|
| `rrfive://loja/perfil` | `perfil_loja` | JSON: `{ nome, slug, fuso, moeda, plataformas[] { id, nome }, meiosPagamento[], instituicoes[], areasLiberadas[] { area, rotulo } }` |
| `rrfive://glossario` | `glossario_metricas` | Markdown em português: regras gerais, vendas, DRE, engenharia de cardápio, caixa, contas a pagar e estoque |

Recursos não dependem de área e ficam sempre disponíveis. Leituras são registradas no log de uso (`resources/read`).

## Prompts

| Nome | Argumentos | Áreas exigidas | Orientação gerada |
|---|---|---|---|
| `analise_semanal` | `semanaTerminandoEm?` | `SALES` | Comparar a semana com a anterior (faturamento, pedidos, ticket, plataformas, dias); 3 destaques e 3 pontos de atenção |
| `comparar_periodos` | `inicioA, fimA, inicioB, fimB` | `SALES`, `FINANCIAL` | Tabela de vendas e DRE dos dois períodos, com variação absoluta e percentual, e causas prováveis |
| `diagnostico_margem_cardapio` | `inicio?, fim?` | `MENU` | Ações por classificação e simulação de +5% nos WORKHORSE de maior volume |
| `saude_caixa_30_dias` | nenhum | `CASH`, `PAYABLES` | Cruzar a projeção de caixa com as contas a vencer e apontar dias de risco |

Os prompts só orientam o LLM sobre quais tools chamar e como estruturar a análise. Eles não carregam dados. Um prompt só aparece se **todas** as suas áreas estiverem liberadas.
