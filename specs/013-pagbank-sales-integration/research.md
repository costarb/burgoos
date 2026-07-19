# Research: Integracao de Vendas PagBank

## Decision: adapter comum por provider e canal

**Decision**: Definir um `SalesProviderAdapter` com capacidades declaradas, validacao de configuracao e coleta diaria. O PagBank implementa canal `API`; CSV passa a produzir o mesmo modelo normalizado por um parser de canal `FILE`.

**Rationale**: Provider e transporte variam independentemente. O contrato comum preserva o fluxo de pre-visualizacao, normalizacao, deduplicacao e importacao e evita acoplar novos providers ao formato PagBank.

**Alternatives considered**:

- Acrescentar chamada PagBank diretamente ao importador CSV: simples inicialmente, mas mistura transporte, layout e persistencia.
- Reutilizar adapters de delivery: rejeitado porque estes operam pedidos em tempo real, webhooks e sincronizacao bidirecional, enquanto EDI importa historico financeiro.

## Decision: consulta diaria e limite de periodo

**Decision**: Decompor o intervalo inclusivo em dias, limitar a 31 dias por run e consultar sequencialmente as paginas de cada dia, permitindo concorrencia controlada apenas entre dias em evolucao posterior.

**Rationale**: O endpoint EDI aceita uma data e pagina ate 1.000 itens. O limite mantem tempo, volume e retomada previsiveis e reduz risco de rate limiting cuja cota nao e publicada.

**Alternatives considered**:

- Intervalo arbitrario: gera runs longos e dificulta feedback e retomada.
- Alta concorrencia entre dias: pode pressionar limite externo desconhecido e complicar ordenacao/auditoria.

## Decision: integralidade governada por VALIDADO

**Decision**: Somente marcar um dia `READY` quando todas as paginas terminarem e o header `VALIDADO` for explicitamente `TRUE`. Ausencia, `FALSE`, dia atual ou futuro resulta em `BLOCKED` e zero vendas elegiveis daquele dia.

**Rationale**: PagBank declara D+1 como prazo e fornece o header exatamente para impedir consumo de dados incompletos. D-1 sozinho e expectativa, nao prova de integralidade.

**Alternatives considered**:

- Importar D-1 sem conferir header: pode consumir dado parcial.
- Aceitar `VALIDADO` ausente: falha aberta e incompatibilidade silenciosa.

## Decision: pre-visualizacao persistida e confirmacao por runId

**Decision**: Persistir run, dias e movimentos antes de exibir a pre-visualizacao. A confirmacao opera o snapshot pelo identificador do run e verifica tenant, estado e versao.

**Rationale**: Impede adulteracao do navegador, preserva exatamente o conjunto revisado, suporta historico e permite retomar importacoes parciais sem nova chamada externa.

**Alternatives considered**:

- Devolver movimentos ao browser e reenviar na confirmacao: aumenta superficie de fraude e payload.
- Consultar novamente ao confirmar: o conjunto pode mudar e deixa de corresponder a pre-visualizacao.

## Decision: persistir payload externo com retencao controlada

**Decision**: Manter payload JSON original de cada movimento e resumo normalizado no banco para auditoria, redigindo campos sensiveis. Reter runs e movimentos por 180 dias; preservar indefinidamente apenas identidade externa minima e referencia do pedido.

**Rationale**: A ausencia de sandbox e a complexidade dos eventos EDI exigem diagnostico reproduzivel, mas o payload completo nao precisa permanecer para sempre.

**Alternatives considered**:

- Nao persistir payload: reduz dados, mas inviabiliza auditoria e diagnostico do mapeamento.
- Guardar indefinidamente: custo e risco desnecessarios.

## Decision: idempotencia garantida no banco

**Decision**: Criar unicidade por `tenantId + provider + externalSaleId` no movimento/identidade e manter o `externalPaymentId` no pedido. Importacao usa insert atomico e trata conflito como duplicado.

**Rationale**: Checagem previa em aplicacao nao protege contra runs concorrentes. A chave tenant-scoped tambem evita colisao entre estabelecimentos/providers.

**Alternatives considered**:

- Indice atual de `Order(tenantId, externalPaymentId)`: nao e unico nem inclui provider.
- Lock apenas em memoria: nao funciona com multiplas instancias e nao protege reinicio.

## Decision: transacao por venda e coordenacao de runs

**Decision**: Impedir runs de importacao sobrepostos para tenant/provider/datas por verificacao persistida e processar cada venda em transacao independente.

**Rationale**: Uma venda defeituosa nao deve bloquear as demais; a unicidade continua como protecao final contra corrida.

**Alternatives considered**:

- Uma transacao para todo periodo: locks longos e perda de todo progresso por um registro invalido.
- Sem coordenacao de runs: desperdica chamadas e gera resultados confusos, mesmo que a chave unica evite duplicidade final.

## Decision: reutilizar pipeline de pedido historico

**Decision**: Extrair do `HistoricalOrderImportService` uma operacao que recebe `NormalizedHistoricalSale`. Parsers CSV e PagBank convertem suas entradas para esse contrato antes de validar produto, estrategia, instituicao e valores.

**Rationale**: Mantem composicao de itens, snapshot de rentabilidade e regras financeiras consistentes em todos os canais.

**Alternatives considered**:

- Duplicar criacao de pedido no modulo PagBank: alto risco de divergencia em estoque, rentabilidade e relatorios.

## Decision: credencial cifrada e servico compartilhado

**Decision**: Extrair a cifra AES-256-GCM usada por delivery para `IntegrationSecretService`, com chave obrigatoria fora de desenvolvimento e rotacao por nova linha de credencial. Respostas retornam apenas `hasCredential` e metadados nao secretos.

**Rationale**: O projeto ja possui formato testado de cifra autenticada. Centralizar evita duas implementacoes e facilita redacao consistente.

**Alternatives considered**:

- Variavel de ambiente unica para todos os tenants: nao suporta token/USER por loja.
- Texto aberto no banco: viola requisitos de seguranca.

## Decision: testes sem sandbox

**Decision**: Converter exemplos JSON oficiais aplicaveis em fixtures versionadas e simular status, headers, paginacao e erros HTTP. Executar smoke test real somente quando USER/TOKEN forem fornecidos em ambiente controlado.

**Rationale**: A API EDI nao oferece sandbox e endpoints reais retornam operacoes reais. Fixtures permitem cobertura deterministica antes do token.

**Alternatives considered**:

- Adiar testes ate obter token: bloqueia desenvolvimento e deixa casos raros sem cobertura.
- Chamar producao na suite automatica: inseguro, instavel e dependente de dados reais.

## Decision: mapeamento conservador de eventos

**Decision**: Criar pedido somente para eventos classificados explicitamente como venda pelo catalogo EDI v3.00. Cancelamento, chargeback, ajuste ou codigo desconhecido vira `NON_SALE`/`REJECTED`, preservado para auditoria.

**Rationale**: A primeira versao nao reconcilia eventos posteriores. Falhar fechado evita receita duplicada ou alteracao indevida.

**Alternatives considered**:

- Tratar todo movimento positivo como venda: codigos e sinais financeiros nao garantem semantica.
