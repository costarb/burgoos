# Contratos: Ações pelo MCP

Todas as tools abaixo são **ações**: só aparecem e só executam com conexão OAuth com `mcp:write`, loja com `actionsEnabled`, área habilitada e permissão atual do usuário. Erros de autorização usam o código `ACTION_NOT_ALLOWED` com a explicação do que falta. Datas `AAAA-MM-DD`; valores em reais.

Identificação por nome: sem diferenciar maiúsculas e acentos; nome desconhecido ou ambíguo → `INVALID_FILTER` com `opcoes[]`.

## Área `PAYABLES` — permissão `finance.manage`

### `criar_conta_a_pagar`
Anotações: `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`.

Entrada:
- `descricao` (até 160), `valorReais` (> 0), `vencimento`, `categoria` (nome ou id) — obrigatórios.
- `fornecedor?` (nome ou id), `competencia?` (`AAAA-MM-DD` ou `AAAA-MM` → dia 1), `documento?` (até 120), `observacoes?` (até 500).
- `classificacaoDre?`: `FIXED_COST` | `VARIABLE_EXPENSE` | `EXCLUDED` (ausente = seguir a categoria).
- `recorrencia?`: `{ frequencia: "WEEKLY"|"MONTHLY"|"YEARLY"…, intervalo ≥ 1, inicio, fim? , quantidade? }` (fim ou quantidade obrigatório).
- `confirmarDuplicidade?: boolean`.

Saída: `{ criadas: number, contas: [{ id, descricao, categoria, fornecedor, competencia, vencimento, valorReais, classificacaoDre, status }] }`. Duplicidade sem confirmação: `{ duplicidade: true, contaExistente: {...}, mensagem }` sem criar.

### `registrar_pagamento_conta`
Anotações: `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`.

Entrada: `contaId`, `valorReais` (> 0, até o restante), `dataPagamento`, `contaFinanceira` (nome ou id), `observacoes?`.
Saída: `{ conta: { id, descricao, valorReais, pagoReais, restanteReais, status } }`.

### `editar_conta_a_pagar`
Anotações: `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: true`.

Entrada: `contaId` + qualquer subconjunto de `descricao`, `valorReais`, `vencimento`, `competencia` (ou `null`), `categoria`, `fornecedor` (ou `null`), `documento`, `observacoes`, `classificacaoDre` (ou `null` = seguir a categoria). Recorrência não é editável (só a ocorrência).
Saída: `{ antes: {...}, depois: {...} }`. Regras da tela: conta cancelada não muda; valor não pode ficar abaixo do já pago.

### `cancelar_conta_a_pagar`
Anotações: `readOnlyHint: false`, `destructiveHint: true`, `idempotentHint: true`.

Entrada: `contaId`, `motivo` (obrigatório, até 500).
Saída: `{ conta: { id, descricao, status: "CANCELLED", motivo } }`. Conta com pagamento não pode ser cancelada.

### `contas_a_pagar` (leitura, alterada)
Cada item de `contas[]` ganha `id`.

## Área `SALES` — permissão `integrations.sales.manage`

### `integracoes_de_vendas`
Anotações: `readOnlyHint: true` (consulta de apoio às ações; exige as mesmas condições das ações).

Saída: `integracoes[] { id, provedor: "PAGBANK"|"MERCADO_PAGO"|"IFOOD", nome, situacao, periodoMaximoDias, ultimaImportacao? { id, periodo, situacao, concluidaEm } }`, `produtosParaAtribuicao[] { id, nome }` (até 50, ativos).

### `importar_vendas_previa`
Anotações: `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`.

Entrada:
- `integracao`: id, nome ou provedor (provedor só quando houver uma integração ativa dele).
- `inicio` e `fim`, **ou** `cargaInicialDias: 30|60|90` (somente Mercado Pago; período termina ontem).
- `atribuicao`: `"AUTOMATICA_POR_VALOR"` (padrão) | `"PRODUTO_FIXO"` + `produto` (nome ou id).

Regras: período ≤ máximo do provedor (PagBank 31, iFood 90, Mercado Pago 364 dias); integração ativa; sem execução em andamento para a integração.
Saída: `{ execucaoId, situacao, periodo, mensagem: "Use importacao_status para acompanhar." }`.

### `importacao_status`
Anotações: `readOnlyHint: true`.

Entrada: `execucaoId`.
Saída: `{ execucaoId, provedor, periodo, situacao, origem, resumo?: { encontradas, vendasNovas, duplicadas, pedidosExistentes, rejeitadas, importadas, falhas, diasBloqueados: [{ data, motivo }] }, podeConfirmar: boolean, erros? }`.

### `importar_vendas_confirmar`
Anotações: `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: true`.

Entrada: `execucaoId`.
Regras: só `PREVIEW_READY` ou `PARTIALLY_READY`; repetir não duplica.
Saída: `{ execucaoId, situacao, mensagem }`.

## Configuração e consentimento (API admin / OAuth)

- `PATCH /api/admin/mcp/configuration`: body ganha `actionsEnabled?: boolean` (permissão de gerenciar o MCP). Resposta inclui `actionsEnabled`.
- Metadata OAuth: `scopes_supported: ["mcp:read", "mcp:write"]`.
- Consentimento: body ganha `allowActions?: boolean`. Escopo gravado: `mcp:read` ou `mcp:read mcp:write` (só se a loja permitir e o usuário tiver alguma permissão de ação).
- Conexões na tela de configuração exibem "Leitura" ou "Leitura e ações".
