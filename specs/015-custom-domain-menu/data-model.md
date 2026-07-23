# Data Model: Cardapio por dominio da loja

## Tenant

Representa a loja e continua sendo a raiz do isolamento.

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `id` | UUID | yes | Existing primary key |
| `slug` | string | yes | Existing unique operational identifier |
| `publicDomain` | string | no | Globally unique canonical hostname without `www.` |
| `active` | boolean | yes | Domain resolution only succeeds when true |
| `config` | JSON | yes | Existing public profile; unchanged |

### Validation

- Lowercase ASCII hostname.
- Maximum 253 characters; each label has 1 to 63 characters.
- At least two labels outside explicit local-development handling.
- Letters, digits and hyphens only inside labels; labels cannot begin or end with hyphen.
- No protocol, port, path, query, fragment, whitespace or credentials.
- Remove one leading `www.` and one trailing dot before uniqueness comparison.
- Empty administrative input removes the association and stores `null`.

### Database constraints

- Nullable unique constraint on `public_domain`.
- Existing unique constraint on `slug` remains unchanged.
- Migration adds no default and therefore preserves all current stores as domain-unconfigured.

## Public menu resolution

Derived read model; no persistence.

| Field | Source | Rule |
|-------|--------|------|
| `requestedDomain` | HTTP request | Normalized before lookup |
| `tenantId` | Tenant | Never exposed as a routing fallback |
| `slug` | Tenant | Returned inside the existing public menu contract |
| `active` | Tenant | Must be true |

Resolution is stateless: `normalizedDomain -> active Tenant -> existing PublicMenu`.

## Public order

No schema change. The order continues to store `tenantId`, resolved by the existing public ordering service from the slug returned in the trusted menu response.

## Audit event

No schema change. The existing store audit logger receives domain mutations in `STORE_UPDATED` metadata:

- previous canonical domain;
- new canonical domain or `null`;
- authenticated platform administrator;
- operation timestamp supplied by the existing logger.

## State transitions

```text
UNCONFIGURED --assign unique valid domain--> CONFIGURED
CONFIGURED --replace with unique valid domain--> CONFIGURED
CONFIGURED --remove domain--> UNCONFIGURED
CONFIGURED --deactivate store--> INACCESSIBLE
INACCESSIBLE --reactivate store--> CONFIGURED
```

Invalid or duplicate input leaves the previous state unchanged.
