import { IdempotencyStatus, Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  IDEMPOTENCY_CONFLICT,
  IdempotencyService,
} from "../src/common/idempotency/idempotency.service";
import { PrismaService } from "../src/platform/database/prisma.service";

type RecordRow = {
  id: string;
  tenantId: string;
  scope: string;
  key: string;
  requestHash: string;
  status: IdempotencyStatus;
  responseCode: number | null;
  responseBody: Prisma.JsonValue | null;
  expiresAt: Date;
};

function createPersistence() {
  const rows: RecordRow[] = [];
  let sequence = 0;
  const idempotencyRecord = {
    create: async ({ data }: { data: Omit<RecordRow, "id" | "status" | "responseCode" | "responseBody"> }) => {
      if (
        rows.some(
          (row) =>
            row.tenantId === data.tenantId && row.scope === data.scope && row.key === data.key,
        )
      ) {
        throw new Prisma.PrismaClientKnownRequestError("unique", {
          code: "P2002",
          clientVersion: "test",
        });
      }
      const row: RecordRow = {
        ...data,
        id: `record-${++sequence}`,
        status: IdempotencyStatus.PENDING,
        responseCode: null,
        responseBody: null,
      };
      rows.push(row);
      return row;
    },
    findUniqueOrThrow: async ({
      where: { tenantId_scope_key: key },
    }: {
      where: { tenantId_scope_key: Pick<RecordRow, "tenantId" | "scope" | "key"> };
    }) => {
      const row = rows.find(
        (candidate) =>
          candidate.tenantId === key.tenantId &&
          candidate.scope === key.scope &&
          candidate.key === key.key,
      );
      if (!row) throw new Error("not found");
      return row;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<RecordRow> }) => {
      const row = rows.find((candidate) => candidate.id === where.id);
      if (!row) throw new Error("not found");
      Object.assign(row, data);
      return row;
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: { id: string; status?: IdempotencyStatus; OR?: unknown[] };
      data: Partial<RecordRow>;
    }) => {
      const row = rows.find((candidate) => candidate.id === where.id);
      if (!row) return { count: 0 };
      if (where.status && row.status !== where.status) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    },
  };

  return {
    rows,
    service: new IdempotencyService({ idempotencyRecord } as unknown as PrismaService),
  };
}

describe("POS/payments foundation integration", () => {
  it("isolates the same idempotency key between tenants", async () => {
    const { service, rows } = createPersistence();
    const request = { total: 25 };

    const tenantA = await service.claim({
      tenantId: "tenant-a",
      scope: "POST:/orders",
      key: "retry-1",
      request,
    });
    const tenantB = await service.claim({
      tenantId: "tenant-b",
      scope: "POST:/orders",
      key: "retry-1",
      request,
    });

    expect(tenantA.kind).toBe("claimed");
    expect(tenantB.kind).toBe("claimed");
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.tenantId))).toEqual(new Set(["tenant-a", "tenant-b"]));
  });

  it("replays a completed response only for the original tenant and payload", async () => {
    const { service } = createPersistence();
    const first = await service.claim({
      tenantId: "tenant-a",
      scope: "POST:/orders",
      key: "retry-2",
      request: { items: [{ productId: "p1", quantity: 1 }] },
    });
    expect(first.kind).toBe("claimed");
    if (first.kind !== "claimed") throw new Error("claim expected");

    await service.complete(first.recordId, 201, { orderId: "order-1" });
    const replay = await service.claim({
      tenantId: "tenant-a",
      scope: "POST:/orders",
      key: "retry-2",
      request: { items: [{ quantity: 1, productId: "p1" }] },
    });

    expect(replay).toEqual({
      kind: "replay",
      statusCode: 201,
      body: { orderId: "order-1" },
    });
  });

  it("rejects reuse of a tenant key with a different payload", async () => {
    const { service } = createPersistence();
    await service.claim({
      tenantId: "tenant-a",
      scope: "POST:/orders",
      key: "retry-3",
      request: { total: 10 },
    });

    await expect(
      service.claim({
        tenantId: "tenant-a",
        scope: "POST:/orders",
        key: "retry-3",
        request: { total: 11 },
      }),
    ).rejects.toMatchObject({
      response: { statusCode: 409, code: IDEMPOTENCY_CONFLICT },
    });
  });
});
