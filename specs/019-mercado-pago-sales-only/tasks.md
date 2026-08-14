# Tasks: Importação exclusiva de vendas do Mercado Pago

**Input**: Design documents from `/specs/019-mercado-pago-sales-only/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Obrigatórios porque a classificação afeta pedidos e faturamento.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar contratos e fixtures compartilhados pela implementação.

- [x] T001 Adicionar `operation_type` ao contrato de pagamento em apps/api/src/management/sales-integrations/mercado-pago/mercado-pago.types.ts
- [x] T002 Atualizar a fixture de pagamento comercial em apps/api/src/management/sales-integrations/mercado-pago/**fixtures**/mercado-pago.fixtures.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Fixar por testes o contrato fail-closed antes de alterar a regra.

- [x] T003 Escrever matriz de testes para operações comerciais, financeiras, ausentes e desconhecidas em apps/api/src/management/sales-integrations/mercado-pago/mercado-pago.mapper.spec.ts
- [x] T004 [P] Cobrir o filtro remoto `status=approved` e a paginação inalterada em apps/api/src/management/sales-integrations/mercado-pago/mercado-pago.client.spec.ts

**Checkpoint**: Os novos testes devem falhar pela ausência da classificação e do filtro.

---

## Phase 3: User Story 1 - Importar somente recebimentos de vendas (Priority: P1) MVP

**Goal**: Impedir que transferências, aplicações, resgates e operações desconhecidas gerem pedidos.

**Independent Test**: Processar venda aprovada e movimentos não comerciais; somente a venda contém `sale` e pode avançar ao pedido.

- [x] T005 [US1] Implementar allowlist fail-closed e razão `NON_SALE_OPERATION` em apps/api/src/management/sales-integrations/mercado-pago/mercado-pago.mapper.ts
- [x] T006 [US1] Adicionar `status=approved` à busca paginada em apps/api/src/management/sales-integrations/mercado-pago/mercado-pago.client.ts
- [x] T007 [US1] Validar mapper e client com os testes de apps/api/src/management/sales-integrations/mercado-pago/mercado-pago.mapper.spec.ts e apps/api/src/management/sales-integrations/mercado-pago/mercado-pago.client.spec.ts

**Checkpoint**: Operações não comerciais são `NON_SALE`; vendas normais continuam importáveis.

---

## Phase 4: User Story 2 - Abranger todos os canais de venda (Priority: P1)

**Goal**: Aceitar vendas online, presenciais e recorrentes, independentemente de cartão, PIX ou saldo suportado.

**Independent Test**: Mapear os três tipos comerciais com meios distintos e obter `SALE` válida para cada um.

- [x] T008 [P] [US2] Cobrir `regular_payment`, `pos_payment` e `recurring_payment` com meios suportados em apps/api/src/management/sales-integrations/mercado-pago/mercado-pago.mapper.spec.ts
- [x] T009 [US2] Cobrir página mista e página sem venda válida em apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-sales-provider.adapter.spec.ts
- [x] T010 [US2] Validar que o adapter continua percorrendo e expondo movimentos `NON_SALE` em apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-sales-provider.adapter.ts

**Checkpoint**: Todos os canais documentados funcionam e páginas sem venda não interrompem o período.

---

## Phase 5: User Story 3 - Tornar a decisão auditável (Priority: P2)

**Goal**: Aplicar a mesma decisão em sync, reconciliação e webhook, sem retry de movimento financeiro.

**Independent Test**: Entregar `money_transfer` por reconciliação e webhook e verificar persistência como `NON_SALE`, processamento concluído e ausência de venda.

- [x] T011 [P] [US3] Adicionar regressão de operação não comercial em apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-reconciliation.service.spec.ts
- [x] T012 [P] [US3] Adicionar regressão de operação não comercial sem retry em apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-webhook.service.spec.ts
- [x] T013 [US3] Preservar `operation_type` no raw redigido e validar a razão auditável em apps/api/src/management/sales-integrations/mercado-pago/mercado-pago.mapper.spec.ts

**Checkpoint**: Todos os caminhos compartilham a classificação e explicam itens desconsiderados.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validar o conjunto e manter artefatos sincronizados.

- [x] T014 Executar os testes Mercado Pago e corrigir regressões nos arquivos de apps/api/src/management/sales-integrations/mercado-pago/
- [x] T015 Executar typecheck e lint da API conforme scripts de apps/api/package.json
- [x] T016 Validar os cenários documentados em specs/019-mercado-pago-sales-only/quickstart.md
- [x] T017 Atualizar todos os checkboxes concluídos em specs/019-mercado-pago-sales-only/tasks.md
- [x] T018 Bloquear PIX entre contas do mesmo titular usando `is_same_bank_account_owner` em apps/api/src/management/sales-integrations/mercado-pago/mercado-pago.mapper.ts
- [x] T019 Cobrir transferências do mesmo titular e PIX comercial em apps/api/src/management/sales-integrations/mercado-pago/mercado-pago.mapper.spec.ts
- [x] T020 Corrigir agrupamento UTC para o dia comercial de São Paulo em apps/api/src/management/reports/sales-report.service.ts
- [x] T021 Adicionar regressão do SQL de agrupamento diário em apps/api/src/management/reports/sales-report.service.spec.ts

---

## Dependencies & Execution Order

- Setup (T001-T002) precede os testes e a implementação.
- Foundational (T003-T004) fixa o comportamento esperado e bloqueia US1.
- US1 (T005-T007) entrega o MVP e é base para US2 e US3.
- US2 e US3 podem avançar em paralelo após US1; seus testes editam arquivos distintos, exceto T013, que sucede T008.
- Polish depende das três histórias.

## Parallel Opportunities

- T004 pode ser escrito em paralelo com T003.
- T008 pode avançar em paralelo com T011 e T012 depois do mapper base.
- T011 e T012 são independentes entre si.

## Parallel Example: User Story 3

```text
Task T011: teste de reconciliação para money_transfer
Task T012: teste de webhook para money_transfer sem retry
```

## Implementation Strategy

### MVP First

1. Completar T001-T007.
2. Executar mapper/client e confirmar que nenhum não comercial produz `sale`.
3. Só então ampliar canais e fluxos em T008-T013.

### Incremental Delivery

1. Contrato e fixture.
2. Testes falhando.
3. Classificação central e filtro remoto.
4. Regressão dos canais.
5. Regressão de reconciliação/webhook.
6. Validação integral.
