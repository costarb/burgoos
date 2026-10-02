import { randomUUID } from "crypto";
import { vi } from "vitest";

/**
 * In-memory OAuth models for the MCP fake Prisma (installed by createMcpFakePrisma). Relations
 * are always expanded on reads, which is enough for the query shapes the OAuth services use.
 */

export interface FakeOAuthUser {
  id: string;
  name: string;
  tenantId?: string;
  role?: "OWNER" | "ADMIN" | "OPERATOR";
  isMaster?: boolean;
  status?: "ACTIVE" | "INVITED" | "INACTIVE" | "LOCKED";
}

export interface FakeAssignment {
  userId: string;
  tenantId: string;
  status: "ACTIVE" | "INACTIVE";
  permissions: string[];
}

type Row = Record<string, unknown> & { id: string };
type Where = Record<string, unknown>;

export interface OAuthFakeState {
  users: FakeOAuthUser[];
  assignments: FakeAssignment[];
  oauthClients: Row[];
  oauthRequests: Row[];
  oauthConnections: Row[];
  oauthTokens: Row[];
}

export function matches(row: Record<string, unknown>, where: Where = {}): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (condition === undefined) return true;
    if (key === "OR") return (condition as Where[]).some((clause) => matches(row, clause));
    if (key === "AND") return (condition as Where[]).every((clause) => matches(row, clause));
    const value = row[key];
    if (condition === null) return value === null || value === undefined;
    if (condition instanceof Date) return value instanceof Date && value.getTime() === condition.getTime();
    if (typeof condition === "object" && !Array.isArray(condition)) {
      const ops = condition as Record<string, unknown>;
      if ("in" in ops) return (ops.in as unknown[]).includes(value);
      const comparable = (input: unknown) => (input instanceof Date ? input.getTime() : (input as number));
      if (value === null || value === undefined) return false;
      if ("lt" in ops && !(comparable(value) < comparable(ops.lt))) return false;
      if ("lte" in ops && !(comparable(value) <= comparable(ops.lte))) return false;
      if ("gt" in ops && !(comparable(value) > comparable(ops.gt))) return false;
      if ("gte" in ops && !(comparable(value) >= comparable(ops.gte))) return false;
      return true;
    }
    return value === condition;
  });
}

export function installOAuthModels(
  prisma: Record<string, unknown>,
  state: OAuthFakeState & {
    tenants: Array<{ id: string; name: string; slug: string; active: boolean; deactivatedAt: Date | null }>;
    configurations: Array<{ tenantId: string; enabled: boolean; enabledAreas: string[] }>;
  }
) {
  const expandUser = (userId: unknown) => {
    const user = state.users.find((item) => item.id === userId);
    if (!user) return null;
    return {
      status: "ACTIVE",
      role: "OPERATOR",
      isMaster: false,
      ...user,
      storeAssignments: state.assignments
        .filter((assignment) => assignment.userId === user.id && assignment.status === "ACTIVE")
        .map((assignment) => ({
          tenantId: assignment.tenantId,
          profile: { permissions: assignment.permissions.map((key) => ({ permission: { key } })) },
        })),
    };
  };
  const expandTenant = (tenantId: unknown) => {
    const tenant = state.tenants.find((item) => item.id === tenantId);
    if (!tenant) return null;
    return { ...tenant, mcpConfiguration: state.configurations.find((item) => item.tenantId === tenant.id) ?? null };
  };
  const expandClient = (id: unknown) => state.oauthClients.find((item) => item.id === id) ?? null;
  const expandConnection = (id: unknown) => {
    const connection = state.oauthConnections.find((item) => item.id === id);
    if (!connection) return null;
    return {
      ...connection,
      client: expandClient(connection.clientId),
      user: expandUser(connection.userId),
      tenant: expandTenant(connection.tenantId),
    };
  };

  const model = (
    rows: () => Row[],
    expand: (row: Row) => Record<string, unknown>,
    defaults: (data: Record<string, unknown>) => Record<string, unknown> = () => ({})
  ) => {
    const find = (where: Where) => rows().find((row) => matches(row, where));
    return {
      findUnique: vi.fn(async ({ where }: { where: Where }) => {
        const row = find(where);
        return row ? expand(row) : null;
      }),
      findFirst: vi.fn(async ({ where }: { where: Where }) => {
        const row = find(where);
        return row ? expand(row) : null;
      }),
      findMany: vi.fn(async ({ where = {} }: { where?: Where } = {}) =>
        rows()
          .filter((row) => matches(row, where))
          .sort((a, b) => ((b.createdAt as Date)?.getTime() ?? 0) - ((a.createdAt as Date)?.getTime() ?? 0))
          .map(expand)
      ),
      count: vi.fn(async ({ where = {} }: { where?: Where } = {}) => rows().filter((row) => matches(row, where)).length),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const now = new Date();
        const row = { id: randomUUID(), createdAt: now, updatedAt: now, ...defaults(data), ...data } as Row;
        rows().push(row);
        return expand(row);
      }),
      update: vi.fn(async ({ where, data }: { where: Where; data: Record<string, unknown> }) => {
        const row = find(where);
        if (!row) throw new Error("Record not found");
        Object.assign(row, data, { updatedAt: new Date() });
        return expand(row);
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Where; data: Record<string, unknown> }) => {
        const targets = rows().filter((row) => matches(row, where));
        targets.forEach((row) => Object.assign(row, data));
        return { count: targets.length };
      }),
      upsert: vi.fn(
        async ({ where, create, update }: { where: Where; create: Record<string, unknown>; update: Record<string, unknown> }) => {
          const row = find(where);
          if (row) {
            Object.assign(row, update, { updatedAt: new Date() });
            return expand(row);
          }
          const now = new Date();
          const created = { id: randomUUID(), createdAt: now, updatedAt: now, ...create } as Row;
          rows().push(created);
          return expand(created);
        }
      ),
      deleteMany: vi.fn(async ({ where = {} }: { where?: Where } = {}) => {
        const before = rows().length;
        const kept = rows().filter((row) => !matches(row, where));
        rows().splice(0, rows().length, ...kept);
        return { count: before - kept.length };
      }),
    };
  };

  prisma.mcpOAuthClient = model(() => state.oauthClients, (row) => ({ ...row }));
  prisma.mcpOAuthAuthorizationRequest = model(
    () => state.oauthRequests,
    (row) => ({ ...row, client: expandClient(row.clientId), connection: expandConnection(row.connectionId) }),
    () => ({ status: "PENDING", state: null, userId: null, tenantId: null, connectionId: null, codeHash: null, codeExpiresAt: null })
  );
  prisma.mcpOAuthConnection = model(
    () => state.oauthConnections,
    (row) => expandConnection(row.id) ?? { ...row },
    () => ({ lastUsedAt: null, revokedAt: null, revokedByUserId: null, revokedReason: null })
  );
  prisma.mcpOAuthToken = model(
    () => state.oauthTokens,
    (row) => ({ ...row, connection: expandConnection(row.connectionId) }),
    () => ({ rotatedAt: null })
  );
  prisma.user = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => expandUser(where.id)),
  };

  const tenantModel = prisma.tenant as Record<string, unknown>;
  tenantModel.findMany = vi.fn(
    async ({ where = {} }: { where?: Where & { mcpConfiguration?: { is?: { enabled?: boolean } } } } = {}) => {
      const { mcpConfiguration, ...plain } = where;
      return state.tenants
        .filter((tenant) => matches(tenant as unknown as Record<string, unknown>, plain))
        .map((tenant) => expandTenant(tenant.id)!)
        .filter((tenant) =>
          mcpConfiguration?.is?.enabled === undefined
            ? true
            : (tenant.mcpConfiguration?.enabled ?? false) === mcpConfiguration.is.enabled
        )
        .sort((a, b) => a.name.localeCompare(b.name));
    }
  );
}
