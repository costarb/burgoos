# Research: Operacoes Financeiras e Experiencia Administrativa

## Admin navigation

**Decision**: Introduce a persistent admin shell with navigation grouped into Operacao, Cadastros, Financeiro, Relatorios and Plataforma. Desktop uses a stable sidebar; small screens use a drawer with the same information architecture.

**Rationale**: Current pages expose isolated return links and a large admin index, making movement between related tasks slow and inconsistent.

**Alternatives considered**: Keeping the admin index as primary navigation or adding independent navigation to every page were rejected because they do not preserve location and duplicate logic.

## Operation feedback

**Decision**: Define one UI operation-state contract (`idle`, `pending`, `success`, `error`, optional progress/result counts) and reusable components for submit state, inline result and toast-level notification.

**Rationale**: A shared contract allows simple forms, client mutations and batch imports to communicate consistently while preventing duplicate submission.

**Alternatives considered**: Toast-only feedback was rejected because long-running and recoverable errors need persistent context. Page-specific implementations were rejected because current inconsistency is the problem being solved.

## Financial source of truth

**Decision**: Persist payable obligations, payable payments and explicit manual cash movements. Calculate the cash ledger and projection as a read model that also consumes order receipts.

**Rationale**: Orders already contain acquired net amount and release date. Deriving their cash events avoids copying financial data and prevents synchronization failures.

**Alternatives considered**: Copying order receipts into cash movements and persisting projected events were rejected because source corrections would require fragile synchronization.

## Realized and projected receipts

**Decision**: Treat an order receipt as realized on its effective release date: explicit expected release date when present, otherwise the existing immediate/D+30 rule. Before that date it is projected. Payment institution maps the event to a financial account; missing mappings appear in an explicit unallocated bucket.

**Rationale**: This preserves current sales-report semantics and enables a useful pilot cash position without bank integration.

**Alternatives considered**: Manual confirmation of every receipt was rejected for the first increment due to operational cost. Treating every delivered sale as immediate was rejected because it overstates cash.

## Payable lifecycle

**Decision**: Store each payable occurrence independently, link recurring occurrences through an optional recurrence group, and store one or more payment records. Status is derived from cancellation, due date and paid amount.

**Rationale**: Independent occurrences support partial payments and future recurrence edits without rewriting paid history.

**Alternatives considered**: A perpetual recurring payable and status-only storage were rejected because they make individual dates, payments and overdue state ambiguous.

## Corrections and audit

**Decision**: Financial records with realized effects are never physically deleted. Corrections use cancellation or reversal records, and every financial mutation writes an immutable audit snapshot.

**Rationale**: Operational financial totals must remain explainable after corrections.

**Alternatives considered**: Application logs are not a queryable tenant-scoped business history. Directly editing realized payments erases the original event.

## Transfers and balance

**Decision**: Represent a transfer as one movement with source and destination accounts. It reduces one account, increases the other and has zero consolidated impact.

**Rationale**: A single transfer record makes the relationship explicit and prevents orphaned paired entries.

**Alternatives considered**: Two unrelated manual movements were rejected because users could reverse only one side.

## Sales chart labels

**Decision**: Extend the existing lightweight daily chart with formatted value labels, adaptive label density and exact-value interaction.

**Rationale**: Current chart data already contains the required values, and a new chart dependency is unnecessary for this bounded enhancement.

**Alternatives considered**: Adding a chart library immediately was rejected because it increases dependency and migration cost without required business value.

## UX rollout

**Decision**: Roll out the shell and operation-feedback primitives first, then migrate administrative routes through an explicit audit matrix.

**Rationale**: Common primitives make the full UX review measurable and prevent one-off redesigns.

**Alternatives considered**: Redesigning every page independently in one pass was rejected because it creates a large, difficult-to-verify change.
