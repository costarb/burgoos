# Research: Validação Delivery Real

## Decision: Pilot is single-store operational, but tenant-ready

**Rationale**: The first goal is validating a real delivery shift. A full SaaS onboarding/billing system would slow learning, but omitting tenant boundaries would create rework.

**Alternatives considered**:

- Pure single-store schema: fastest now, costly later.
- Full SaaS onboarding with plans/billing: too much scope before validation.

## Decision: WhatsApp starts as deep link

**Rationale**: A `wa.me` link with order summary is enough to support customer communication during the pilot without approval flows, templates or Cloud API setup.

**Alternatives considered**:

- WhatsApp Cloud API: powerful but heavier operational setup.
- No WhatsApp: misses the communication habit of small food businesses.

## Decision: Payment is informational/manual

**Rationale**: The pilot can accept cash, manual PIX or card on delivery. Online payment introduces PSP integration, refunds and reconciliation before demand is proven.

**Alternatives considered**:

- PIX QR dynamic: useful soon, not required to validate orders.
- Card online: too much compliance and integration overhead for MVP.

## Decision: Server calculates order total

**Rationale**: Prices in the client cannot be trusted. Server-side calculation protects against manipulation and stale carts.

**Alternatives considered**:

- Client-sent totals: faster to implement, unsafe for real orders.

## Decision: Realtime for admin order arrival

**Rationale**: A real kitchen/delivery operation needs quick notification when a new order arrives. Socket.io is already in the architecture standards.

**Alternatives considered**:

- Manual refresh: too error-prone in a live shift.
- Polling: acceptable fallback, but less responsive.
