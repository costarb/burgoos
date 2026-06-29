# Data Model: Repaginacao do Fluxo de Contas a Pagar

## Existing Entities

### Payable

Conta a pagar ja existente no dominio financeiro.

**Relevant fields**:

- `id`
- `tenantId`
- `categoryId`
- `supplierId`
- `description`
- `documentReference`
- `competenceDate`
- `dueDate`
- `expectedAmount`
- `notes`
- `cancelledAt`
- `cancellationReason`

**Relationships**:

- Belongs to tenant.
- Belongs to financial category.
- Optionally belongs to supplier.
- Has many payments.
- Has audit history.

**Validation notes**:

- Inclusion and edition continue using current payable validation rules.
- Cancelled payables cannot be edited.
- Expected amount cannot be lower than already paid amount.

### PayablesSummary

Resumo financeiro derivado da consulta atual.

**Fields**:

- `totalExpected`: total previsto.
- `totalPaid`: total pago.
- `totalRemaining`: total em aberto.
- `overdueAmount`: total vencido.
- `openCount`: quantidade em aberto.
- `overdueCount`: quantidade vencida.

**Validation notes**:

- Must be calculated from the same result set represented by current query filters.
- Must remain visible even when values are zero.

## New Entities

### ExportJob

Solicitacao persistida de exportacao assincrona para qualquer tela administrativa habilitada. Contas a pagar usa este modelo com contexto `PAYABLES`.

**Fields**:

- `id`: unique identifier.
- `tenantId`: owner tenant.
- `requestedByUserId`: user who requested the export.
- `context`: export origin, e.g. `PAYABLES`.
- `format`: one of `CSV`, `PDF`, `XLSX`.
- `status`: one of `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `EXPIRED`.
- `filtersSnapshot`: query filters captured when the job was requested.
- `columnsSnapshot`: optional selected/exported columns captured when the job was requested.
- `requestedAt`: creation timestamp.
- `startedAt`: processing start timestamp, nullable.
- `completedAt`: completion timestamp, nullable.
- `failedAt`: failure timestamp, nullable.
- `errorMessage`: user-safe failure reason, nullable.
- `fileName`: generated file name, nullable.
- `fileMimeType`: generated file MIME type, nullable.
- `fileStorageKey`: storage identifier for generated file, nullable.
- `fileSizeBytes`: generated file size, nullable.
- `expiresAt`: timestamp after which generated file may no longer be available, nullable.

**Relationships**:

- Belongs to tenant.
- Belongs to requesting user.
- Is processed by a context provider registered for `context`.
- May create one or more notifications.

**Validation rules**:

- `format` must be one of the supported export formats.
- `context` must be registered and enabled for the authenticated user's permissions.
- `filtersSnapshot` must only contain filters allowed for the selected context.
- Job result must only include data visible to the requesting tenant and user.
- Completed jobs must have file metadata.
- Failed jobs must have a safe error message.

**State transitions**:

```text
PENDING -> PROCESSING -> COMPLETED
PENDING -> PROCESSING -> FAILED
PENDING -> FAILED
COMPLETED -> EXPIRED
```

### OperationalNotification

Notificacao persistida exibida no centro de notificacoes.

**Fields**:

- `id`: unique identifier.
- `tenantId`: owner tenant.
- `recipientUserId`: user who should see the notification.
- `type`: e.g. `PAYABLE_EXPORT_COMPLETED`, `PAYABLE_EXPORT_FAILED`.
- `status`: one of `UNREAD`, `READ`, `ARCHIVED`.
- `severity`: one of `INFO`, `SUCCESS`, `WARNING`, `ERROR`.
- `title`: short user-facing title.
- `message`: user-facing detail.
- `actionLabel`: optional action text.
- `actionUrl`: optional URL/action target.
- `relatedEntityType`: optional source type, e.g. `payable_export_job`.
- `relatedEntityId`: optional source id.
- `createdAt`: creation timestamp.
- `readAt`: timestamp when marked read, nullable.

**Relationships**:

- Belongs to tenant.
- Belongs to recipient user.
- May reference a payable export job.

**Validation rules**:

- Notifications must be scoped by tenant and recipient user.
- Failed export notifications must not expose internal stack traces or secrets.
- Action URL for export completion must only resolve for the same tenant and user.

**State transitions**:

```text
UNREAD -> READ
UNREAD -> ARCHIVED
READ -> ARCHIVED
```

### NotificationCenterState

Read model for the web notification center.

**Fields**:

- `unreadCount`: count of unread notifications for current user.
- `items`: recent notifications ordered newest first.

**Validation rules**:

- Must only include notifications for the authenticated user and tenant.
- Should support empty state.

## Contract Types

### ExportContext

Enum values for this feature:

- `PAYABLES`

Future administrative screens may add new values without changing job lifecycle semantics.

### ExportFormat

Enum values:

- `CSV`
- `PDF`
- `XLSX`

### ExportStatus

Enum values:

- `PENDING`
- `PROCESSING`
- `COMPLETED`
- `FAILED`
- `EXPIRED`

### OperationalNotificationStatus

Enum values:

- `UNREAD`
- `READ`
- `ARCHIVED`

### OperationalNotificationSeverity

Enum values:

- `INFO`
- `SUCCESS`
- `WARNING`
- `ERROR`
