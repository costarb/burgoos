# Research: Filtros de Pesquisa em Contas a Pagar

## Decision: usar `competenceMonth=YYYY-MM` para mes de referencia

**Rationale**: A conta a pagar ja possui `competenceDate`, capturada no formulario como mes/ano. Um parametro mensal explicito evita ambiguidade com `start` e `end`, que hoje representam vencimento.

**Alternatives considered**:

- Reutilizar `start` e `end` para competencia: rejeitado porque mudaria o significado atual dos filtros de periodo e poderia quebrar usuarios que pesquisam por vencimento.
- Enviar uma data completa `competenceDate`: rejeitado porque a necessidade do usuario e competencia mensal, nao um dia especifico.

## Decision: converter `competenceMonth` em intervalo fechado-aberto de mes

**Rationale**: Filtrar `competenceDate >= primeiro dia do mes` e `< primeiro dia do mes seguinte` funciona mesmo quando o registro carrega dia interno diferente e deixa o contrato mensal simples para a UI.

**Alternatives considered**:

- Comparar string formatada no banco: rejeitado por ser menos portavel e menos amigavel a indices.
- Normalizar todos os registros para dia 1 antes do filtro: rejeitado por alterar dados existentes fora do escopo.

## Decision: reutilizar filtros existentes de `categoryId` e `supplierId`

**Rationale**: O DTO e a service ja aceitam esses campos na query. A feature deve expor esses controles na tela, documentar o contrato e garantir testes de combinacao.

**Alternatives considered**:

- Criar novos endpoints especificos por categoria/fornecedor: rejeitado por duplicar comportamento de pesquisa e fragmentar a tela.
- Filtrar categoria/fornecedor somente no frontend: rejeitado porque traria resultados indevidos para a pagina e poderia afetar resumo e performance.

## Decision: manter opcoes em `/api/admin/financial/payables/options`

**Rationale**: A tela ja carrega categorias, contas financeiras e fornecedores por esse endpoint. Reusar esse contrato evita chamadas extras e preserva tenant isolation no backend.

**Alternatives considered**:

- Carregar categorias e fornecedores por endpoints separados na tela de contas a pagar: rejeitado por aumentar latencia e duplicar carregamento ja existente.

## Decision: nao criar migracao obrigatoria nesta fase

**Rationale**: `Payable` ja tem `competenceDate`, `categoryId`, `supplierId` e indices por tenant com vencimento/categoria/fornecedor. Para volume piloto, a query por competencia deve ser aceitavel. A necessidade de indice por `competenceDate` deve ser validada quando houver volume maior.

**Alternatives considered**:

- Adicionar imediatamente `@@index([tenantId, competenceDate])`: possivel, mas rejeitado no plano inicial para evitar churn de schema sem evidencia de gargalo.
