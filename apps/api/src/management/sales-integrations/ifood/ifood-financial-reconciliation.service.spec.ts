import { describe, expect, it, vi } from "vitest";
import {
  ifoodFinancialEventsFixture,
  ifoodSettlementsFixture,
} from "./__fixtures__/ifood-financial.fixtures";
import { IfoodFinancialReconciliationService } from "./ifood-financial-reconciliation.service";

function setup(cursor: object | null = null, impacted = "41.99") {
  const run = {
    id: "run",
    tenantId: "tenant",
    integrationId: "integration",
    requestedByUserId: null,
    trigger: "MANUAL",
    startDate: new Date("2026-09-01"),
    endDate: new Date("2026-09-07"),
    status: "PENDING",
    salesCount: 0,
    eventCount: 0,
    settlementCount: 0,
    divergentCount: 0,
    cursor,
    errorCode: null,
    errorMessage: null,
    startedAt: null,
    completedAt: null,
    createdAt: new Date(),
  };
  const prisma = {
    financialReconciliationRun: {
      findFirst: vi.fn().mockResolvedValue(run),
      update: vi.fn().mockImplementation(async ({ data }) => ({ ...run, ...data })),
    },
    externalFinancialSale: { findFirst: vi.fn().mockResolvedValue({ id: "sale" }) },
    externalFinancialEvent: {
      upsert: vi.fn(),
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: impacted } }),
    },
    externalSettlement: { upsert: vi.fn() },
  };
  const client = {
    fetchFinancialEvents: vi
      .fn()
      .mockResolvedValue({ events: ifoodFinancialEventsFixture.financialEvents, pagesFetched: 1 }),
    fetchSettlements: vi.fn().mockResolvedValue(ifoodSettlementsFixture),
  };
  const observability = { reconciliationCompleted: vi.fn() };
  const service = new IfoodFinancialReconciliationService(
    prisma as never,
    {
      getCredential: vi
        .fn()
        .mockResolvedValue({
          accessToken: "token",
          merchantId: "merchant",
          environment: "TEST",
          expiresAt: null,
        }),
    } as never,
    client as never,
    {
      encrypt: vi.fn((value) => `encrypted:${value}`),
      decrypt: vi.fn((value: string) => value.replace("encrypted:", "")),
    } as never,
    undefined,
    observability as never
  );
  return { service, prisma, client, observability };
}

describe("IfoodFinancialReconciliationService", () => {
  it("upserts events idempotently and matches settlements within R$ 0.01 without touching orders", async () => {
    const { service, prisma } = setup();
    await service.process("tenant", "run");
    expect(prisma.externalFinancialEvent.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.externalFinancialEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_integrationId_providerEventKey: expect.objectContaining({ tenantId: "tenant" }),
        },
      })
    );
    expect(prisma.externalSettlement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ reconciliationStatus: "MATCHED" }),
      })
    );
    expect(prisma).not.toHaveProperty("order");
  });

  it("resumes after event completion without downloading or mutating events again", async () => {
    const { service, prisma, client } = setup({ eventsDone: true }, "40.00");
    await service.process("tenant", "run");
    expect(client.fetchFinancialEvents).not.toHaveBeenCalled();
    expect(prisma.externalFinancialEvent.upsert).not.toHaveBeenCalled();
    expect(prisma.externalSettlement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ reconciliationStatus: "DIVERGENT" }),
      })
    );
  });

  it("reuses an active request made within six hours", async () => {
    const { service, prisma, client } = setup();
    Object.assign(prisma, {
      externalReconciliationFile: {
        findFirst: vi
          .fn()
          .mockResolvedValue({
            providerRequestId: "request",
            competence: "2026-09",
            status: "PROCESSING",
            orderCount: null,
            lineCount: null,
            expiresAt: null,
            errorCode: null,
            errorMessage: null,
          }),
      },
    });
    const result = await service.requestFile("tenant", "integration", "2026-09");
    expect(result).toMatchObject({ requestId: "request", reused: true });
    expect(client).not.toHaveProperty("requestReconciliationFile");
  });

  it("reports completion counts and duration to the observability service", async () => {
    const { service, observability } = setup();
    await service.process("tenant", "run");
    expect(observability.reconciliationCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant",
        integrationId: "integration",
        runId: "run",
        status: "COMPLETED",
      })
    );
  });
});
