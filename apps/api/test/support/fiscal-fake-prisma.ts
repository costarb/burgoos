import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

/**
 * In-memory Prisma for fiscal tests. Supports the query shapes the fiscal services use:
 * equality / in / notIn / not / lt(e) / gt(e) / contains filters, OR / AND, relation filters
 * (`{ relation: { is: {...} } }`, `some`), relations expanded on reads (depth 3), `_count`,
 * compound unique keys (`tenantId_provider`), `increment`, unique constraints (P2002) and
 * interactive or array `$transaction`.
 */

type Row = Record<string, unknown> & { id: string };
type Where = Record<string, unknown>;

interface Relation {
  table: string;
  /** Field on this row (belongs-to) or on the other row (has-many / has-one). */
  local: string;
  foreign: string;
  kind: "one" | "many";
}

const RELATIONS: Record<string, Record<string, Relation>> = {
  tenant: {
    users: { table: "user", local: "id", foreign: "tenantId", kind: "many" },
    visualConfigurations: { table: "storeVisualConfiguration", local: "id", foreign: "tenantId", kind: "many" },
  },
  category: {
    fiscalProfile: { table: "fiscalProfile", local: "fiscalProfileId", foreign: "id", kind: "one" },
    products: { table: "product", local: "id", foreign: "categoryId", kind: "many" },
  },
  product: {
    fiscalProfile: { table: "fiscalProfile", local: "fiscalProfileId", foreign: "id", kind: "one" },
    category: { table: "category", local: "categoryId", foreign: "id", kind: "one" },
    complementAssignments: { table: "productComplementAssignment", local: "id", foreign: "productId", kind: "many" },
  },
  productComplement: {
    fiscalProfile: { table: "fiscalProfile", local: "fiscalProfileId", foreign: "id", kind: "one" },
  },
  productComplementAssignment: {
    complement: { table: "productComplement", local: "complementId", foreign: "id", kind: "one" },
    product: { table: "product", local: "productId", foreign: "id", kind: "one" },
  },
  fiscalProfile: {
    categories: { table: "category", local: "id", foreign: "fiscalProfileId", kind: "many" },
    products: { table: "product", local: "id", foreign: "fiscalProfileId", kind: "many" },
    complements: { table: "productComplement", local: "id", foreign: "fiscalProfileId", kind: "many" },
  },
  order: {
    items: { table: "orderItem", local: "id", foreign: "orderId", kind: "many" },
    paymentAllocations: { table: "paymentAllocation", local: "id", foreign: "orderId", kind: "many" },
    serviceTab: { table: "serviceTab", local: "serviceTabId", foreign: "id", kind: "one" },
    orderPlatform: { table: "orderPlatform", local: "orderPlatformId", foreign: "id", kind: "one" },
    fiscalDocuments: { table: "fiscalDocument", local: "id", foreign: "orderId", kind: "many" },
  },
  orderItem: {
    modifications: { table: "orderItemModification", local: "id", foreign: "orderItemId", kind: "many" },
    order: { table: "order", local: "orderId", foreign: "id", kind: "one" },
  },
  serviceTab: {
    orders: { table: "order", local: "id", foreign: "serviceTabId", kind: "many" },
    paymentAllocations: { table: "paymentAllocation", local: "id", foreign: "serviceTabId", kind: "many" },
    fiscalDocuments: { table: "fiscalDocument", local: "id", foreign: "serviceTabId", kind: "many" },
  },
  paymentAllocation: {
    payment: { table: "payment", local: "paymentId", foreign: "id", kind: "one" },
  },
  fiscalDocument: {
    order: { table: "order", local: "orderId", foreign: "id", kind: "one" },
    serviceTab: { table: "serviceTab", local: "serviceTabId", foreign: "id", kind: "one" },
    events: { table: "fiscalDocumentEvent", local: "id", foreign: "documentId", kind: "many" },
  },
};

/** Single-column or compound unique constraints (null values never collide, like Postgres). */
const UNIQUES: Record<string, string[][]> = {
  fiscalConfiguration: [["tenantId"]],
  fiscalIssuer: [["tenantId"]],
  fiscalProviderConnection: [["tenantId", "provider"]],
  platformFiscalProviderConfiguration: [["provider"]],
  fiscalCertificate: [["activeKey"]],
  fiscalProfile: [["tenantId", "name"]],
  fiscalDocument: [["activeKey"], ["accessKey"]],
};

const DEFAULTS: Record<string, () => Record<string, unknown>> = {
  fiscalProfile: () => ({ origin: 0, commercialUnit: "UN", cest: null, benefitCode: null, active: true }),
  fiscalProviderConnection: () => ({ status: "DRAFT", settings: {}, credentialCiphertext: null, lastErrorCode: null, lastErrorMessage: null, connectedAt: null, tokenExpiresAt: null }),
  fiscalCertificate: () => ({ status: "ACTIVE", lastExpiryAlertDays: null, replacedAt: null }),
  fiscalDocument: () => ({
    status: "PENDING", externalId: null, number: null, series: null, accessKey: null, protocol: null, issuedAt: null,
    authorizedAt: null, consumerDocument: null, rejectionCode: null, rejectionMessage: null, xmlAssetKey: null,
    danfeAssetKey: null, qrCodeUrl: null, consultationUrl: null, danfeUrl: null, cancelReason: null, cancelRequestedAt: null,
    cancelDeadlineAt: null, cancelReminderAt: null, cancelledAt: null, cancelProtocol: null, cancelXmlAssetKey: null,
    attempts: 0, nextSyncAt: null, requestedByUserId: null, orderId: null, serviceTabId: null,
    taxDivergences: null, taxDivergenceAt: null, taxDivergenceReviewedAt: null,
  }),
  category: () => ({ fiscalProfileId: null, active: true }),
  product: () => ({ fiscalProfileId: null, active: true }),
  productComplement: () => ({ fiscalProfileId: null, active: true }),
};

export type FiscalFakeTables = Record<string, Row[]>;

export function createFiscalFakePrisma(seed: Partial<Record<string, Array<Record<string, unknown>>>> = {}) {
  const tables: FiscalFakeTables = {};
  const table = (name: string) => (tables[name] ??= []);
  for (const [name, rows] of Object.entries(seed)) {
    for (const row of rows ?? []) table(name).push({ id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...(DEFAULTS[name]?.() ?? {}), ...row } as Row);
  }

  const relationOf = (model: string, field: string) => RELATIONS[model]?.[field];

  const related = (model: string, row: Row, field: string): Row | Row[] | null | undefined => {
    const relation = relationOf(model, field);
    if (!relation) return undefined;
    const candidates = table(relation.table).filter((other) => other[relation.foreign] === row[relation.local]);
    return relation.kind === "many" ? candidates : (candidates[0] ?? null);
  };

  const expand = (model: string, row: Row, depth: number, include?: Record<string, unknown>): Record<string, unknown> => {
    const result: Record<string, unknown> = { ...row };
    if (depth <= 0) return result;
    for (const field of Object.keys(RELATIONS[model] ?? {})) {
      const relation = relationOf(model, field) as Relation;
      const value = related(model, row, field);
      result[field] = Array.isArray(value)
        ? value.map((item) => expand(relation.table, item, depth - 1))
        : value
          ? expand(relation.table, value, depth - 1)
          : null;
    }
    const count = include?._count as { select?: Record<string, boolean> } | undefined;
    if (count?.select) {
      result._count = Object.fromEntries(
        Object.keys(count.select).map((field) => [field, ((related(model, row, field) as Row[]) ?? []).length])
      );
    }
    return result;
  };

  const flattenWhere = (where: Where): Where => {
    const flat: Where = {};
    for (const [key, value] of Object.entries(where)) {
      if (key.includes("_") && value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
        Object.assign(flat, value);
      } else flat[key] = value;
    }
    return flat;
  };

  const comparable = (input: unknown) =>
    input instanceof Date ? input.getTime() : input instanceof Prisma.Decimal ? input.toNumber() : (input as number);

  const matches = (model: string, row: Row, where: Where = {}): boolean =>
    Object.entries(flattenWhere(where)).every(([key, condition]) => {
      if (condition === undefined) return true;
      if (key === "OR") return (condition as Where[]).some((clause) => matches(model, row, clause));
      if (key === "AND") return (condition as Where[]).every((clause) => matches(model, row, clause));
      if (key === "NOT") return !matches(model, row, condition as Where);
      const relation = relationOf(model, key);
      if (relation) {
        const value = related(model, row, key);
        const ops = (condition ?? {}) as Record<string, Where | null>;
        if (relation.kind === "many") {
          const list = (value as Row[]) ?? [];
          if ("some" in ops) return list.some((item) => matches(relation.table, item, ops.some ?? {}));
          if ("none" in ops) return !list.some((item) => matches(relation.table, item, ops.none ?? {}));
          if ("every" in ops) return list.every((item) => matches(relation.table, item, ops.every ?? {}));
          return true;
        }
        const one = value as Row | null;
        if (condition === null) return one === null;
        if ("is" in ops) return ops.is === null ? one === null : Boolean(one) && matches(relation.table, one as Row, ops.is as Where);
        if ("isNot" in ops) return ops.isNot === null ? one !== null : !one || !matches(relation.table, one, ops.isNot as Where);
        return Boolean(one) && matches(relation.table, one as Row, condition as Where);
      }
      const value = row[key];
      if (condition === null) return value === null || value === undefined;
      if (condition instanceof Date) return value instanceof Date && value.getTime() === condition.getTime();
      if (typeof condition === "object" && !Array.isArray(condition)) {
        const ops = condition as Record<string, unknown>;
        if ("in" in ops && !(ops.in as unknown[]).includes(value)) return false;
        if ("notIn" in ops && (ops.notIn as unknown[]).includes(value)) return false;
        if ("not" in ops) {
          // SQL semantics: `column <> value` never matches NULL rows.
          if (ops.not === null ? value === null || value === undefined : value === null || value === undefined || value === ops.not) return false;
        }
        if ("contains" in ops && !String(value ?? "").toLowerCase().includes(String(ops.contains).toLowerCase())) return false;
        if ("has" in ops && !(Array.isArray(value) && value.includes(ops.has))) return false;
        const range = ["lt", "lte", "gt", "gte"].filter((op) => op in ops);
        if (range.length) {
          if (value === null || value === undefined) return false;
          if ("lt" in ops && !(comparable(value) < comparable(ops.lt))) return false;
          if ("lte" in ops && !(comparable(value) <= comparable(ops.lte))) return false;
          if ("gt" in ops && !(comparable(value) > comparable(ops.gt))) return false;
          if ("gte" in ops && !(comparable(value) >= comparable(ops.gte))) return false;
        }
        return true;
      }
      return value === condition;
    });

  const applyData = (row: Row, data: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date) && !(value instanceof Prisma.Decimal)) {
        const ops = value as Record<string, unknown>;
        if ("increment" in ops) {
          row[key] = Number(row[key] ?? 0) + Number(ops.increment);
          continue;
        }
        if ("decrement" in ops) {
          row[key] = Number(row[key] ?? 0) - Number(ops.decrement);
          continue;
        }
        if ("set" in ops) {
          row[key] = ops.set;
          continue;
        }
        if ("connect" in ops) continue;
      }
      row[key] = value;
    }
  };

  const assertUnique = (model: string, candidate: Row) => {
    for (const fields of UNIQUES[model] ?? []) {
      if (fields.some((field) => candidate[field] === null || candidate[field] === undefined)) continue;
      const clash = table(model).find(
        (other) => other !== candidate && other.id !== candidate.id && fields.every((field) => other[field] === candidate[field])
      );
      if (clash) {
        throw new Prisma.PrismaClientKnownRequestError(`Unique constraint failed on ${fields.join(",")}`, {
          code: "P2002",
          clientVersion: "fake",
          meta: { target: fields },
        });
      }
    }
  };

  const sortRows = (rows: Row[], orderBy: unknown) => {
    const orders = (Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []) as Array<Record<string, "asc" | "desc">>;
    if (!orders.length) return rows;
    return [...rows].sort((a, b) => {
      for (const order of orders) {
        const [field, direction] = Object.entries(order)[0] ?? [];
        if (!field || typeof direction !== "string") continue;
        const left = comparable(a[field]) as unknown as string | number;
        const right = comparable(b[field]) as unknown as string | number;
        if (left === right) continue;
        const result = left > right ? 1 : -1;
        return direction === "desc" ? -result : result;
      }
      return 0;
    });
  };

  const model = (name: string) => ({
    findUnique: async ({ where, include }: { where: Where; include?: Record<string, unknown> }) => {
      const row = table(name).find((item) => matches(name, item, where));
      return row ? expand(name, row, 3, include) : null;
    },
    findUniqueOrThrow: async ({ where, include }: { where: Where; include?: Record<string, unknown> }) => {
      const row = table(name).find((item) => matches(name, item, where));
      if (!row) throw new Error(`${name} not found`);
      return expand(name, row, 3, include);
    },
    findFirst: async ({ where = {}, orderBy, include }: { where?: Where; orderBy?: unknown; include?: Record<string, unknown> } = {}) => {
      const row = sortRows(table(name).filter((item) => matches(name, item, where)), orderBy)[0];
      return row ? expand(name, row, 3, include) : null;
    },
    findFirstOrThrow: async ({ where = {}, orderBy, include }: { where?: Where; orderBy?: unknown; include?: Record<string, unknown> } = {}) => {
      const row = sortRows(table(name).filter((item) => matches(name, item, where)), orderBy)[0];
      if (!row) throw new Error(`${name} not found`);
      return expand(name, row, 3, include);
    },
    findMany: async ({ where = {}, orderBy, include, skip, take }: { where?: Where; orderBy?: unknown; include?: Record<string, unknown>; skip?: number; take?: number } = {}) => {
      const rows = sortRows(table(name).filter((item) => matches(name, item, where)), orderBy);
      const sliced = rows.slice(skip ?? 0, take === undefined ? undefined : (skip ?? 0) + take);
      return sliced.map((row) => expand(name, row, 3, include));
    },
    count: async ({ where = {} }: { where?: Where } = {}) => table(name).filter((item) => matches(name, item, where)).length,
    create: async ({ data, include }: { data: Record<string, unknown>; include?: Record<string, unknown> }) => {
      const now = new Date();
      const row = { id: randomUUID(), createdAt: now, updatedAt: now, ...(DEFAULTS[name]?.() ?? {}) } as Row;
      applyData(row, data);
      assertUnique(name, row);
      table(name).push(row);
      return expand(name, row, 3, include);
    },
    update: async ({ where, data, include }: { where: Where; data: Record<string, unknown>; include?: Record<string, unknown> }) => {
      const row = table(name).find((item) => matches(name, item, where));
      if (!row) throw new Prisma.PrismaClientKnownRequestError("Record not found", { code: "P2025", clientVersion: "fake" });
      const next = { ...row } as Row;
      applyData(next, data);
      next.updatedAt = new Date();
      assertUnique(name, next);
      Object.assign(row, next);
      return expand(name, row, 3, include);
    },
    updateMany: async ({ where = {}, data }: { where?: Where; data: Record<string, unknown> }) => {
      const targets = table(name).filter((item) => matches(name, item, where));
      for (const row of targets) {
        const next = { ...row } as Row;
        applyData(next, data);
        next.updatedAt = new Date();
        assertUnique(name, next);
        Object.assign(row, next);
      }
      return { count: targets.length };
    },
    upsert: async ({ where, create, update }: { where: Where; create: Record<string, unknown>; update: Record<string, unknown> }) => {
      const row = table(name).find((item) => matches(name, item, where));
      if (row) {
        applyData(row, update);
        row.updatedAt = new Date();
        assertUnique(name, row);
        return expand(name, row, 3);
      }
      const now = new Date();
      const created = { id: randomUUID(), createdAt: now, updatedAt: now, ...(DEFAULTS[name]?.() ?? {}) } as Row;
      applyData(created, create);
      assertUnique(name, created);
      table(name).push(created);
      return expand(name, created, 3);
    },
    delete: async ({ where }: { where: Where }) => {
      const index = table(name).findIndex((item) => matches(name, item, where));
      if (index < 0) throw new Prisma.PrismaClientKnownRequestError("Record not found", { code: "P2025", clientVersion: "fake" });
      const [removed] = table(name).splice(index, 1);
      return removed;
    },
    deleteMany: async ({ where = {} }: { where?: Where } = {}) => {
      const kept = table(name).filter((item) => !matches(name, item, where));
      const count = table(name).length - kept.length;
      tables[name] = kept;
      return { count };
    },
  });

  const models = new Map<string, ReturnType<typeof model>>();
  const prisma: Record<string, unknown> = new Proxy(
    {
      tables,
      table,
      $transaction: async (input: unknown) => {
        if (typeof input === "function") return (input as (tx: unknown) => Promise<unknown>)(prisma);
        return Promise.all(input as Array<Promise<unknown>>);
      },
    },
    {
      get(target, property: string) {
        if (property in target) return (target as Record<string, unknown>)[property];
        if (typeof property !== "string" || property.startsWith("$") || property === "then") return undefined;
        if (!models.has(property)) models.set(property, model(property));
        return models.get(property);
      },
    }
  );
  return prisma as Record<string, unknown> & { tables: FiscalFakeTables; table: (name: string) => Row[] };
}
