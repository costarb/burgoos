# Research: Relatorio Gerencial Consolidado

## Decision: Criar agregador de relatorio gerencial

**Rationale**: Caixa, vendas e contas a pagar ja possuem services/telas com regras proprias. Um agregador evita duplicar regras e permite retornar uma resposta unica para a tela gerencial.

**Alternatives considered**:

- Consultar tres endpoints no frontend: mais simples inicialmente, mas dificulta consistencia, estado de loading, exportacao PDF com snapshot unico e testes de contrato.
- Criar tabelas materializadas: desnecessario para o volume piloto e adiciona manutencao prematura.

## Decision: Reaproveitar calculos existentes como fonte de verdade

**Rationale**: O requisito exige que indicadores batam com as telas de origem. Reusar `CashFlowService`, `SalesReportService` e `AccountsPayableService` reduz risco de divergencia.

**Alternatives considered**:

- Reescrever consultas no novo service: aumentaria duplicidade e risco de definicoes diferentes.
- Calcular tudo no frontend: exporia regras de negocio e aumentaria payloads.

## Decision: Incluir agrupamento de despesas por categoria no backend

**Rationale**: O agrupamento de contas a pagar por tipo/categoria e uma informacao nova, mas deriva de dados existentes e deve ser consistente com o periodo selecionado.

**Alternatives considered**:

- Agrupar no frontend a partir da lista de payables: funcionaria para poucos registros, mas acopla regra de resumo ao cliente.
- Criar tela separada de despesas: nao atende a proposta de visao unica.

## Decision: Usar exportacao PDF assincrona existente

**Rationale**: O sistema ja possui export jobs, notificacoes e download autenticado. O relatorio gerencial deve seguir o mesmo comportamento: solicitacao rapida, processamento paralelo e notificacao ao concluir.

**Alternatives considered**:

- PDF sincrono no clique: pode travar a tela e diverge do padrao recente.
- Download direto do browser: dificulta auditoria, notificacao e snapshot do periodo.

## Decision: PDF gerencial com layout proprio

**Rationale**: O relatorio gerencial precisa explicar o periodo, nao apenas listar dados. O PDF deve conter resumo executivo, secoes e agrupamentos com texto compreensivel.

**Alternatives considered**:

- Reusar PDF tabular de exportacao: insuficiente para uma leitura executiva.
- Exportar somente CSV/XLSX: bom para analise, mas nao atende compartilhamento gerencial.

## Decision: Mes atual como periodo padrao

**Rationale**: O uso principal esperado e fechamento/acompanhamento mensal. Atalhos cobrem mes anterior, trimestre e ano.

**Alternatives considered**:

- Ultimos 30 dias: pode cortar meses contabeis e dificultar conciliacao.
- Ano atual como padrao: pode carregar dados demais e reduzir foco.
