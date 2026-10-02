import { randomUUID } from "crypto";
import { McpDataArea, McpToolCallResult } from "@prisma/client";
import { vi } from "vitest";
import { FakeAssignment, FakeOAuthUser, installOAuthModels } from "./mcp-oauth-fake";

/**
 * In-memory stand-in for the Prisma models used by the MCP feature. It understands only the
 * query shapes the MCP services issue, which keeps the integration tests independent of a
 * running database.
 */

export interface FakeTenant {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  deactivatedAt: Date | null;
}

export type FakeUser = FakeOAuthUser;

export interface FakeMcpConfiguration {
  id: string;
  tenantId: string;
  enabled: boolean;
  enabledAreas: McpDataArea[];
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FakeMcpToken {
  id: string;
  tenantId: string;
  name: string;
  tokenHash: string;
  tokenPrefix: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  revokedByUserId: string | null;
  lastUsedAt: Date | null;
  createdByUserId: string | null;
  createdAt: Date;
}

export interface FakeMcpToolCall {
  id: string;
  tenantId: string;
  tokenId: string | null;
  method: string;
  target: string | null;
  arguments: unknown;
  result: McpToolCallResult;
  errorCode: string | null;
  durationMs: number;
  occurredAt: Date;
}

export interface FakeAuditEvent {
  id: string;
  actorUserId: string | null;
  storeId: string | null;
  eventType: string;
  result: string;
  metadata: unknown;
}

type Where = Record<string, unknown>;

export function createMcpFakePrisma() {
  const state = {
    tenants: [] as FakeTenant[],
    users: [] as FakeUser[],
    configurations: [] as FakeMcpConfiguration[],
    tokens: [] as FakeMcpToken[],
    calls: [] as FakeMcpToolCall[],
    audits: [] as FakeAuditEvent[],
    assignments: [] as FakeAssignment[],
    oauthClients: [] as Array<Record<string, unknown> & { id: string }>,
    oauthRequests: [] as Array<Record<string, unknown> & { id: string }>,
    oauthConnections: [] as Array<Record<string, unknown> & { id: string }>,
    oauthTokens: [] as Array<Record<string, unknown> & { id: string }>,
  };

  const userName = (id: string | null) =>
    id ? (state.users.find((user) => user.id === id) ?? null) : null;

  const withTokenIncludes = (token: FakeMcpToken, include?: Record<string, unknown>) => {
    if (!include) return { ...token };
    const result: Record<string, unknown> = { ...token };
    if (include.createdByUser) result.createdByUser = userName(token.createdByUserId);
    if (include.tenant) {
      const tenant = state.tenants.find((item) => item.id === token.tenantId) ?? null;
      const configuration =
        state.configurations.find((item) => item.tenantId === token.tenantId) ?? null;
      result.tenant = tenant ? { ...tenant, mcpConfiguration: configuration } : null;
    }
    return result;
  };

  const matchesToken = (token: FakeMcpToken, where: Where = {}, now = new Date()): boolean =>
    Object.entries(where).every(([key, value]) => {
      if (key === "OR") {
        return (value as Where[]).some((clause) => matchesToken(token, clause, now));
      }
      if (key === "expiresAt" && value && typeof value === "object") {
        const gt = (value as { gt?: Date }).gt;
        return gt ? token.expiresAt !== null && token.expiresAt > gt : true;
      }
      if (key === "lastUsedAt" && value && typeof value === "object") {
        const lt = (value as { lt?: Date }).lt;
        return lt ? token.lastUsedAt !== null && token.lastUsedAt < lt : true;
      }
      return (token as unknown as Record<string, unknown>)[key] === value;
    });

  const matchesCall = (call: FakeMcpToolCall, where: Where = {}): boolean =>
    Object.entries(where).every(([key, value]) => {
      if (value === undefined) return true;
      if (key === "occurredAt" && value && typeof value === "object") {
        const range = value as { gte?: Date; lte?: Date; lt?: Date };
        if (range.gte && call.occurredAt < range.gte) return false;
        if (range.lte && call.occurredAt > range.lte) return false;
        if (range.lt && call.occurredAt >= range.lt) return false;
        return true;
      }
      return (call as unknown as Record<string, unknown>)[key] === value;
    });

  const prisma = {
    state,
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $transaction: vi.fn(async (input: unknown) => {
      if (typeof input === "function") return (input as (tx: unknown) => unknown)(prisma);
      return Promise.all(input as Promise<unknown>[]);
    }),
    tenant: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        state.tenants.find((tenant) => tenant.id === where.id) ?? null
      ),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
        const tenant = state.tenants.find((item) => item.id === where.id);
        if (!tenant) throw new Error("Tenant not found");
        return tenant;
      }),
    },
    storeMcpConfiguration: {
      findUnique: vi.fn(
        async ({ where, include }: { where: { tenantId: string }; include?: Where }) => {
          const configuration = state.configurations.find(
            (item) => item.tenantId === where.tenantId
          );
          if (!configuration) return null;
          return include?.updatedByUser
            ? { ...configuration, updatedByUser: userName(configuration.updatedByUserId) }
            : { ...configuration };
        }
      ),
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { tenantId: string };
          create: Omit<FakeMcpConfiguration, "id" | "createdAt" | "updatedAt">;
          update: Partial<FakeMcpConfiguration>;
        }) => {
          const now = new Date();
          const existing = state.configurations.find((item) => item.tenantId === where.tenantId);
          if (existing) {
            Object.assign(existing, update, { updatedAt: now });
            return { ...existing };
          }
          const created = { id: randomUUID(), createdAt: now, updatedAt: now, ...create };
          state.configurations.push(created);
          return { ...created };
        }
      ),
    },
    storeMcpToken: {
      findMany: vi.fn(async ({ where, include }: { where: Where; include?: Where }) =>
        state.tokens
          .filter((token) => matchesToken(token, where))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((token) => withTokenIncludes(token, include))
      ),
      findFirst: vi.fn(async ({ where, include }: { where: Where; include?: Where }) => {
        const token = state.tokens.find((item) => matchesToken(item, where));
        return token ? withTokenIncludes(token, include) : null;
      }),
      findUnique: vi.fn(async ({ where, include }: { where: Where; include?: Where }) => {
        const token = state.tokens.find((item) => matchesToken(item, where));
        return token ? withTokenIncludes(token, include) : null;
      }),
      count: vi.fn(
        async ({ where }: { where: Where }) =>
          state.tokens.filter((token) => matchesToken(token, where)).length
      ),
      create: vi.fn(
        async ({
          data,
          include,
        }: {
          data: Omit<
            FakeMcpToken,
            "id" | "createdAt" | "revokedAt" | "revokedByUserId" | "lastUsedAt"
          >;
          include?: Where;
        }) => {
          const token: FakeMcpToken = {
            id: randomUUID(),
            createdAt: new Date(),
            revokedAt: null,
            revokedByUserId: null,
            lastUsedAt: null,
            ...data,
          };
          state.tokens.push(token);
          return withTokenIncludes(token, include);
        }
      ),
      update: vi.fn(
        async ({
          where,
          data,
          include,
        }: {
          where: { id: string };
          data: Partial<FakeMcpToken>;
          include?: Where;
        }) => {
          const token = state.tokens.find((item) => item.id === where.id);
          if (!token) throw new Error("Token not found");
          Object.assign(token, data);
          return withTokenIncludes(token, include);
        }
      ),
      updateMany: vi.fn(
        async ({ where, data }: { where: Where; data: Partial<FakeMcpToken> }) => {
          const targets = state.tokens.filter((token) => matchesToken(token, where));
          targets.forEach((token) => Object.assign(token, data));
          return { count: targets.length };
        }
      ),
    },
    mcpToolCall: {
      create: vi.fn(async ({ data }: { data: Omit<FakeMcpToolCall, "id" | "occurredAt"> }) => {
        const call: FakeMcpToolCall = {
          id: randomUUID(),
          occurredAt: new Date(),
          ...data,
          tokenId: data.tokenId ?? null,
          target: data.target ?? null,
          arguments: data.arguments ?? null,
          errorCode: data.errorCode ?? null,
        };
        state.calls.push(call);
        return call;
      }),
      findMany: vi.fn(
        async ({
          where,
          include,
          skip = 0,
          take,
          select,
        }: {
          where: Where;
          include?: Where;
          skip?: number;
          take?: number;
          select?: Where;
        }) => {
          const rows = state.calls
            .filter((call) => matchesCall(call, where))
            .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
            .slice(skip, take === undefined ? undefined : skip + take);
          if (select) return rows.map((row) => ({ id: row.id }));
          return rows.map((call) =>
            include?.token
              ? {
                  ...call,
                  token: state.tokens.find((token) => token.id === call.tokenId) ?? null,
                }
              : call
          );
        }
      ),
      count: vi.fn(
        async ({ where }: { where: Where }) =>
          state.calls.filter((call) => matchesCall(call, where)).length
      ),
      deleteMany: vi.fn(async ({ where }: { where: { id?: { in: string[] } } }) => {
        const ids = new Set(where.id?.in ?? []);
        const before = state.calls.length;
        state.calls = state.calls.filter((call) => !ids.has(call.id));
        return { count: before - state.calls.length };
      }),
    },
    accessAuditEvent: {
      create: vi.fn(async ({ data }: { data: Omit<FakeAuditEvent, "id"> }) => {
        const event = { id: randomUUID(), ...data };
        state.audits.push(event);
        return event;
      }),
    },
  };

  installOAuthModels(prisma as unknown as Record<string, unknown>, state);

  // Other modules touch unrelated models on startup (schedulers, recovery loops); answer them
  // with empty results so the application boots.
  const inertModels = new Map<string, Record<string, unknown>>();
  const inertModel = () =>
    new Proxy(
      {},
      {
        get: (target: Record<string | symbol, unknown>, method) => {
          if (!(method in target)) {
            target[method] = vi.fn(async () => {
              const name = String(method);
              if (name.startsWith("findMany") || name === "groupBy") return [];
              if (name === "count") return 0;
              if (name.endsWith("Many")) return { count: 0 };
              return null;
            });
          }
          return target[method];
        },
      }
    );

  return new Proxy(prisma, {
    get(target, property, receiver) {
      if (property in target || typeof property === "symbol" || property === "then") {
        return Reflect.get(target, property, receiver);
      }
      const name = String(property);
      if (name.startsWith("$")) return vi.fn(async () => []);
      if (!inertModels.has(name)) inertModels.set(name, inertModel());
      return inertModels.get(name);
    },
  }) as typeof prisma;
}

export type McpFakePrisma = ReturnType<typeof createMcpFakePrisma>;

export function resetMcpFakePrisma(prisma: McpFakePrisma) {
  prisma.state.tenants = [];
  prisma.state.users = [];
  prisma.state.configurations = [];
  prisma.state.tokens = [];
  prisma.state.calls = [];
  prisma.state.audits = [];
  prisma.state.assignments = [];
  prisma.state.oauthClients = [];
  prisma.state.oauthRequests = [];
  prisma.state.oauthConnections = [];
  prisma.state.oauthTokens = [];
}
