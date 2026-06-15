# Research: iFood Delivery Integration

**Feature**: `008-ifood-delivery-integration`
**Source analyzed**: Local PDF provided by the user, `iFood Developer _ Documentation.pdf`
**Analysis date**: 2026-06-15

## Executive Summary

The iFood integration must be treated as an event-driven order workflow with store-scoped authorization, provider-specific deadlines, durable event processing, and explicit acknowledgment. The initial implementation should use polling because the documentation defines a 30-second polling expectation and webhook adoption is more relevant for higher order volume. The domain model must remain provider-neutral, but the iFood adapter must enforce iFood-specific rules for authentication, merchant validation, event acknowledgment, confirmation deadlines, order status transitions, cancellation, delivery tracking, order changes, disputes, and homologation.

## Authentication And Authorization

- iFood APIs use OAuth 2.0 Bearer tokens over HTTPS with TLS 1.2 or higher.
- The system must never hardcode token lifetime. It must rely on the provider expiration metadata returned with the token.
- The documentation references access token expiration windows and refresh-token behavior that vary by application type, so token management must be provider-configurable.
- Expired access tokens return unauthorized responses and should trigger refresh or reauthorization depending on the configured application flow.
- Token strings may be large, so credential storage must support long token values.
- Merchant permission changes can take up to 10 minutes to propagate. A newly authorized store should have a temporary validation state instead of immediately failing as invalid.

## Merchant And Store Readiness

- The integration must validate that the configured account can access the intended iFood merchant/store.
- Merchant status must be monitored because iFood can mark a store as unable to receive orders due to catalog, delivery area, opening hours, or connectivity checks.
- The documentation indicates that order receiving depends on the integration polling as expected, so the health view should include last polling success and merchant readiness.
- Relevant readiness states include healthy, warning, closed, and error-like conditions.

## Order Event Consumption

- iFood order processing is event-driven. The platform sends or exposes events and each event should drive a state transition.
- Polling is the recommended starting path and should run at the documented interval of 30 seconds.
- Polling can be filtered by merchant and event categories/groups, which supports scalable per-store processing.
- Webhooks expose the same event model but require HTTPS handling and signature validation. If webhooks are later enabled, polling should still exist as a fallback or reconciliation mechanism.
- Event records contain identifiers, order id, event code, creation timestamp, and metadata. These values must be stored or mapped to an audit record.

## Event Acknowledgment

- Events must be acknowledged only after successful internal processing.
- Unacknowledged events are returned again by the platform, so ingestion must be idempotent.
- Acknowledgment can be sent in batches, with a documented upper limit per request. The implementation should keep that limit as provider configuration.
- Even events that do not create an internal order should be acknowledged after being safely recorded or intentionally ignored, otherwise they can keep returning and affect integration health.

## Order Details

- A new event may arrive before order details are immediately available. If details are temporarily missing, the integration should retry with bounded exponential backoff.
- The documentation recommends retrying transient detail unavailability for a finite window, not forever.
- Order detail retention is limited, so old orders must be treated as historical internal records rather than repeatedly fetched from iFood.
- The imported order should preserve source, external order id, merchant id, modality, timing, items, options, benefits, fees, totals, payments, customer data, delivery/pickup data, and additional information.
- Customer contact and personal data can be absent or time-limited by platform privacy rules.

## Confirmation And Status Workflow

- iFood orders must be confirmed within 8 minutes according to the documented SLA. For immediate orders, the clock starts at creation; for scheduled orders, it starts around the preparation start timing.
- Missing the confirmation window can cause automatic cancellation and operational penalties.
- After confirmation, the integration should support preparation start, ready-for-pickup, dispatch, and delivery/conclusion mapping according to the order modality.
- Pickup/takeout orders should use the pickup readiness flow rather than dispatch.
- Merchant-delivery orders and iFood-delivery orders have different operational expectations. Tracking information can be available for iFood delivery and should be treated as optional/rate-limited.

## Cancellation, Changes, And Disputes

- Cancellation or refusal must use provider-approved reasons.
- Cancellation outcomes are asynchronous and should be reflected by later platform events.
- Order modifications can arrive after confirmation and must update the internal order or create a visible exception when automatic reconciliation is unsafe.
- Post-delivery disputes or negotiations include deadlines. The system should present the proposal, deadline, operator action, and final outcome.
- Excessive cancellations can generate platform penalties, so cancellation reporting should be visible to admins.

## Homologation Implications

- iFood requires homologation/certification for production use of the order flow.
- Homologation should be performed against the complete application behavior, not only isolated API calls.
- The pilot store must have valid merchant access and credentials before production activation.
- The homologation checklist should cover authentication, merchant validation, polling interval, event acknowledgment, order details, confirm/refuse, status updates, cancellation, webhook signature validation if webhooks are enabled, logs, and operational visibility.

## Design Decisions

1. Use a provider-neutral integration domain model with an iFood adapter.
   - Rationale: The user wants future delivery platforms without major changes.
   - Consequence: Internal entities should not be named only after iFood unless they are adapter-specific.

2. Start with polling for iFood ingestion.
   - Rationale: The documentation defines polling as a baseline and the current expected volume is pilot-store scale.
   - Consequence: A scheduler/worker must manage per-store polling, rate limits, merchant filters, and health.

3. Persist inbound events before order mutation and acknowledge only after durable processing.
   - Rationale: iFood can redeliver unacknowledged events, so safe idempotency is required.
   - Consequence: The event table needs unique provider event identifiers and processing states.

4. Treat provider deadlines as first-class operational data.
   - Rationale: iFood's 8-minute confirmation SLA affects order acceptance, customer experience, and penalties.
   - Consequence: The order queue needs deadline indicators and alerts.

5. Keep webhook support as an extension point, not a prerequisite for the first release.
   - Rationale: Webhooks add operational security requirements and are more useful at higher volume.
   - Consequence: The adapter interface should support both polling and push events, but tasks can prioritize polling.
