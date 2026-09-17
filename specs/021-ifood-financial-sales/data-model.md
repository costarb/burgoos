# Data Model: Sincronização de Vendas Financeiras iFood

## Existing types and entities

### Enums

- `SalesProvider`: adicionar `IFOOD`.
- `PaymentInstitution`: adicionar `IFOOD`; só identifica valores recebidos pelo iFood.
- `PaymentMethod`: reutilizar valores atuais; o normalizado aceita todos e preserva `providerMethod` quando não houver mapeamento.

### SalesIntegration

Adicionar:

| Field                 | Type            | Rules                                                                |
| --------------------- | --------------- | -------------------------------------------------------------------- |
| deliveryIntegrationId | UUID nullable   | Obrigatório para IFOOD; mesma tenant/provider; único                 |
| financialReadiness    | string nullable | PENDING_PERMISSION, READY_TEST, READY_PRODUCTION, REQUIRES_ATTENTION |
| homologationEvidence  | JSON            | Apenas indicadores/datas, nunca segredos                             |

Para IFOOD não haverá `SalesIntegrationCredential`; a integração referencia `DeliveryIntegration`.

### DeliveryIntegration

Adicionar `environment: SalesIntegrationEnvironment`, com padrão `PRODUCTION` para registros legados. Trocar a unicidade para `(tenantId, provider, environment)`. A integração financeira só pode referenciar uma conexão operacional do mesmo tenant, provider e ambiente.

### Existing flow

- `SalesImportRun`: reutilizar preview/confirm; contagens ganham `existingOrders`, `historicalCandidates`, `reconciled`, `unknown`.
- `ExternalSalesMovement`: ocorrência por execução, apontando à venda canônica via ID externo.
- `ExternalSaleIdentity`: manter unique `(tenantId, provider, environment, externalSaleId)`; pode receber o `orderId` operacional.
- `PlatformOrderLink`: sem mudança; lookup por provider, merchant e externalOrderId inicia dedupe.
- `Order`: operacional não tem total/itens/status sobrescritos. Histórico usa `source=IMPORT`, plataforma IFOOD, status entregue, total da cesta e item consolidado sinalizado.

## New entities

### ExternalFinancialSale

Fotografia financeira atual.

| Field                              | Type              | Rules                    |
| ---------------------------------- | ----------------- | ------------------------ |
| id, tenantId, integrationId        | UUID              | Required                 |
| environment, provider              | enum              | Required                 |
| externalSaleId, externalMerchantId | string            | Required                 |
| shortId, category, salesChannel    | string nullable   | Display/context          |
| orderId                            | UUID nullable     | Local order              |
| status                             | string            | Raw status               |
| occurredAt                         | datetime          | UTC                      |
| merchantTimezone                   | string            | Valid timezone           |
| bagAmount                          | decimal(12,2)     | Non-negative             |
| deliveryFeeAmount                  | decimal(12,2)     | Signed/provider value    |
| serviceFeeAmount                   | decimal(12,2)     | Signed/provider value    |
| benefitsAmount                     | decimal(12,2)     | Non-negative             |
| customerPaidAmount                 | decimal(12,2)     | Sum of methods           |
| saleBalanceAmount                  | decimal(12,2)     | Signed financial balance |
| rawPayload                         | JSON              | Redacted                 |
| providerUpdatedAt                  | datetime nullable | Latest external event    |
| lastSyncedAt, createdAt, updatedAt | datetime          | Required                 |

Unique `(tenantId, provider, environment, externalSaleId)`; indexes by tenant/date and integration/status.

### ExternalSalePayment

| Field                   | Type                   | Rules                                     |
| ----------------------- | ---------------------- | ----------------------------------------- |
| id, tenantId, saleId    | UUID                   | Required                                  |
| providerPaymentKey      | string                 | External key or deterministic fingerprint |
| providerMethod          | string                 | Raw code                                  |
| mappedMethod            | PaymentMethod nullable | Null if unknown                           |
| paymentType, brand, nsu | string nullable        | Restricted metadata                       |
| liability               | string                 | IFOOD, STORE or raw unknown               |
| amount                  | decimal(12,2)          | Non-negative                              |
| currency                | string                 | Validated value                           |
| acquirerDocumentMasked  | string nullable        | Never full document                       |
| installmentCount        | int nullable           | Positive                                  |

Unique `(saleId, providerPaymentKey)`; index by tenant/method/liability.

### ExternalSaleInstallment

Fields: `id`, `tenantId`, `paymentId`, `reference`, optional positive `sequence`, non-negative `amount`, optional `expectedPaymentDate`, `status`, `settledAt`. Unique `(paymentId, reference)`.

### ExternalFinancialEvent

| Field                            | Type             | Rules                        |
| -------------------------------- | ---------------- | ---------------------------- |
| id, tenantId, integrationId      | UUID             | Required                     |
| saleId                           | UUID nullable    | Optional for non-order event |
| providerEventKey                 | string           | External ID/fingerprint      |
| externalOrderId                  | string nullable  | Lookup                       |
| name                             | string           | Raw classification           |
| trigger, description, competence | string nullable  | Safe metadata                |
| amount                           | decimal(12,2)    | Signed                       |
| hasTransferImpact                | boolean          | Required                     |
| baseAmount, feePercentage        | decimal nullable | Provider precision           |
| expectedPaymentDate              | date nullable    | Store-local                  |
| occurredAt                       | datetime         | UTC                          |
| settlementExternalId             | string nullable  | Reconciliation link          |
| rawPayload                       | JSON             | Redacted                     |

Unique `(tenantId, integrationId, providerEventKey)`; indexes by sale, competence and expected date.

### ExternalSettlement

Fields: identity/tenant/integration, `externalSettlementId`, raw `product/type/status`, calculation dates, expected/actual payment dates, gross/net values, `reconciliationStatus` (MATCHED, DIVERGENT, PENDING, NOT_APPLICABLE), divergence and redacted payload. Unique `(tenantId, integrationId, externalSettlementId)`.

### ExternalReconciliationFile

Solicitação assíncrona de arquivo mensal. Campos: identidade/tenant/integration, `competence` YYYY-MM, `providerRequestId`, status (REQUESTED, PROCESSING, READY, EXPIRED, FAILED), totalizadores de pedidos/linhas, URL temporária cifrada ou não persistida, expiração, erro seguro e timestamps. Unique `(tenantId, integrationId, providerRequestId)`; índice por integração/competência/data para reutilizar solicitações dentro de seis horas.

### FinancialReconciliationRun

Fields: identity/tenant/integration/requester, trigger (MANUAL, DAILY, HOMOLOGATION), date interval, state (PENDING, FETCHING, COMPLETED, PARTIAL, FAILED), sales/event/settlement counts, safe cursor, error and lifecycle timestamps.

## Relationships

```text
DeliveryIntegration 1 --- 0..1 SalesIntegration (IFOOD)
SalesIntegration 1 --- * ExternalFinancialSale
ExternalFinancialSale 0..1 --- 1 Order
ExternalFinancialSale 1 --- * ExternalSalePayment
ExternalSalePayment 1 --- * ExternalSaleInstallment
ExternalFinancialSale 1 --- * ExternalFinancialEvent
SalesIntegration 1 --- * ExternalSettlement
SalesIntegration 1 --- * ExternalReconciliationFile
SalesIntegration 1 --- * FinancialReconciliationRun
ExternalSaleIdentity * --- 0..1 Order
PlatformOrderLink 1 --- 1 Order
```

## State transitions

```text
PENDING_PERMISSION -> READY_TEST -> READY_PRODUCTION
PENDING_PERMISSION -> REQUIRES_ATTENTION
READY_*            -> REQUIRES_ATTENTION
REQUIRES_ATTENTION -> PENDING_PERMISSION | READY_TEST | READY_PRODUCTION

Reconciliation: PENDING -> FETCHING -> COMPLETED | PARTIAL | FAILED
Resolution: DISCOVERED -> LINKED_EXISTING_ORDER | HISTORICAL_CANDIDATE
HISTORICAL_CANDIDATE -> IMPORTED | REJECTED | REVIEW_REQUIRED
```

## Migration and backfill

1. Add enum values, `DeliveryIntegration.environment` and nullable relation; backfill operational connections as PRODUCTION before replacing their unique constraint.
2. Create financial tables without changing existing provider rows.
3. Link IFOOD SalesIntegration only after explicit admin activation.
4. Do not auto-backfill orders; first preview establishes identities.
5. Preserve scalar order fields while reports adopt provider-aware data.
6. Validate uniques/counts before production reconciliation.
