import { describe, expect, it, vi } from "vitest";
import { SalesImportConfirmationService } from "./sales-import-confirmation.service";

const run = {
  id: "run",
  tenantId: "tenant",
  provider: "PAGBANK",
  channel: "API",
  status: "PREVIEW_READY",
  strategy: "PRICE_WEIGHTED",
  fixedProductId: null,
  counts: { found: 1, new: 1, duplicate: 0, rejected: 0, imported: 0, failed: 0, blockedDays: 0 },
};
const movement = {
  id: "movement",
  externalSaleId: "sale-1",
  normalizedData: {
    provider: "PAGBANK",
    channel: "API",
    providerMovementId: "movement-1",
    externalSaleId: "sale-1",
    occurredAt: "2026-05-30T17:54:00.000Z",
    grossAmount: 25,
    paymentMethod: "PIX",
  },
};

function setup(
  importNormalizedSale = vi.fn().mockResolvedValue({ imported: [{ orderId: "order" }] })
) {
  const prisma = {
    salesImportRun: {
      findFirst: vi.fn().mockResolvedValue(run),
      findFirstOrThrow: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...run, ...data })),
    },
    externalSalesMovement: {
      findMany: vi.fn().mockResolvedValue([movement]),
      update: vi.fn().mockReturnValue({ operation: "movement-update" }),
    },
    externalSaleIdentity: { findUnique: vi.fn() },
    order: { update: vi.fn() },
    $transaction: vi.fn().mockResolvedValue([]),
  };
  const identities = {
    claim: vi.fn().mockResolvedValue(true),
    attachOperationalIfoodOrder: vi.fn().mockResolvedValue(null),
    linkOrder: vi.fn().mockResolvedValue(undefined),
    release: vi.fn().mockResolvedValue(undefined),
  };
  return {
    prisma,
    historical: { importNormalizedSale },
    identities,
    service: new SalesImportConfirmationService(
      prisma as never,
      { importNormalizedSale } as never,
      identities as never
    ),
  };
}

describe("SalesImportConfirmationService", () => {
  it("claims the run, imports the normalized sale and links its durable identity", async () => {
    const { prisma, historical, identities, service } = setup();

    const result = await service.confirm("tenant", "run");

    expect(prisma.salesImportRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant",
          status: { in: ["PREVIEW_READY", "PARTIALLY_READY", "COMPLETED_WITH_ERRORS"] },
        }),
      })
    );
    expect(historical.importNormalizedSale).toHaveBeenCalledWith(
      "tenant",
      movement.normalizedData,
      expect.any(Object)
    );
    expect(identities.claim).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant", externalSaleId: "sale-1" }),
      "API"
    );
    expect(result).toMatchObject({
      status: "COMPLETED",
      counts: expect.objectContaining({ imported: 1, failed: 0 }),
    });
  });

  it("releases an unlinked identity and records a safe per-sale failure", async () => {
    const { prisma, identities, service } = setup(
      vi.fn().mockRejectedValue(new Error("TOKEN-secret"))
    );

    const result = await service.confirm("tenant", "run");

    expect(identities.release).toHaveBeenCalled();
    expect(prisma.externalSalesMovement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rejectionCode: "IMPORT_FAILED",
          rejectionMessage: "Falha ao criar pedido historico",
        }),
      })
    );
    expect(JSON.stringify(prisma.externalSalesMovement.update.mock.calls)).not.toContain(
      "TOKEN-secret"
    );
    expect(result).toMatchObject({
      status: "COMPLETED_WITH_ERRORS",
      counts: expect.objectContaining({ imported: 0, failed: 1 }),
    });
  });

  it("classifies a durable identity conflict as duplicate without creating an order", async () => {
    const { prisma, historical, identities, service } = setup();
    identities.claim.mockResolvedValue(false);

    const result = await service.confirm("tenant", "run");

    expect(historical.importNormalizedSale).not.toHaveBeenCalled();
    expect(prisma.externalSalesMovement.update).toHaveBeenCalledWith({
      where: { id: "movement" },
      data: { status: "DUPLICATE" },
    });
    expect(result).toMatchObject({
      status: "COMPLETED",
      counts: expect.objectContaining({ imported: 0, duplicate: 1 }),
    });
  });

  it("resumes an IMPORTING run after restart without trying to claim it again", async () => {
    const { prisma, service } = setup();
    prisma.salesImportRun.findFirst.mockResolvedValue({ ...run, status: "IMPORTING" });

    await service.confirm("tenant", "run", true);

    expect(prisma.salesImportRun.updateMany).not.toHaveBeenCalled();
    expect(prisma.externalSalesMovement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "tenant",
          runId: "run",
          status: { in: ["NEW", "FAILED", "DUPLICATE"] },
          kind: "SALE",
        },
      })
    );
  });

  it("retries failed movements while preserving the previous imported count", async () => {
    const { prisma, service } = setup();
    prisma.salesImportRun.findFirst.mockResolvedValue({
      ...run,
      status: "COMPLETED_WITH_ERRORS",
      counts: { ...run.counts, imported: 2, failed: 1 },
    });

    const result = await service.confirm("tenant", "run");

    expect(prisma.salesImportRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["PREVIEW_READY", "PARTIALLY_READY", "COMPLETED_WITH_ERRORS"] },
        }),
      })
    );
    expect(result).toMatchObject({
      status: "COMPLETED",
      counts: expect.objectContaining({ imported: 3, failed: 0 }),
    });
  });

  it("keeps successful sales when another sale fails", async () => {
    const importSale = vi
      .fn()
      .mockResolvedValueOnce({ imported: [{ orderId: "order-1" }] })
      .mockRejectedValueOnce(new Error("invalid product"));
    const { prisma, identities, service } = setup(importSale);
    prisma.externalSalesMovement.findMany.mockResolvedValue([
      movement,
      {
        ...movement,
        id: "movement-2",
        externalSaleId: "sale-2",
        normalizedData: { ...movement.normalizedData, externalSaleId: "sale-2" },
      },
    ]);

    const result = await service.confirm("tenant", "run");

    expect(importSale).toHaveBeenCalledTimes(2);
    expect(identities.release).toHaveBeenCalledWith(
      expect.objectContaining({ externalSaleId: "sale-2" })
    );
    expect(result).toMatchObject({
      status: "COMPLETED_WITH_ERRORS",
      counts: expect.objectContaining({ imported: 1, failed: 1 }),
    });
  });

  it("reconciles release information for an already imported PagBank sale", async () => {
    const { prisma, historical, identities, service } = setup();
    prisma.externalSalesMovement.findMany.mockResolvedValue([
      {
        ...movement,
        status: "DUPLICATE",
        normalizedData: {
          ...movement.normalizedData,
          grossAmount: 25,
          feeAmount: 0.5,
          netAmount: 24.5,
          expectedReleaseAt: "2026-05-30",
        },
      },
    ]);
    prisma.externalSaleIdentity.findUnique.mockResolvedValue({ orderId: "existing-order" });

    await service.confirm("tenant", "run");

    expect(historical.importNormalizedSale).not.toHaveBeenCalled();
    expect(identities.claim).not.toHaveBeenCalled();
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: "existing-order" },
      data: expect.objectContaining({
        paymentGrossAmount: 25,
        paymentFeeAmount: 0.5,
        paymentNetAmount: 24.5,
        paymentReleaseExpectedAt: new Date("2026-05-30"),
        paymentReleaseSource: "EXTRACT",
      }),
    });
  });

  it("enriches an existing operational iFood order without creating a historical order", async () => {
    const { prisma, historical, identities } = setup();
    prisma.salesImportRun.findFirst.mockResolvedValue({
      ...run,
      tenantId: "tenant",
      integrationId: "sales-ifood",
      provider: "IFOOD",
      strategy: "FIXED_PRODUCT",
      fixedProductId: "product",
      integration: {
        environment: "PRODUCTION",
        externalMerchantId: "merchant",
      },
    });
    prisma.externalSalesMovement.findMany.mockResolvedValue([
      { ...movement, normalizedData: { ...movement.normalizedData, provider: "IFOOD" } },
    ]);
    prisma.externalSaleIdentity.findUnique.mockResolvedValue({ orderId: "operational-order" });
    identities.attachOperationalIfoodOrder = vi.fn().mockResolvedValue("operational-order");
    const persist = vi.fn().mockResolvedValue({ id: "financial-sale" });
    const service = new SalesImportConfirmationService(
      prisma as never,
      historical as never,
      identities as never,
      { persist } as never
    );

    const result = await service.confirm("tenant", "run");

    expect(historical.importNormalizedSale).not.toHaveBeenCalled();
    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "operational-order", externalMerchantId: "merchant" })
    );
    expect(prisma.externalSalesMovement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "IMPORTED", orderId: "operational-order" }),
      })
    );
    expect(result.counts).toMatchObject({ enriched: 1, created: 0, reconciled: 1 });
  });

  it("returns a completed iFood run unchanged when confirmation is repeated", async () => {
    const { prisma, historical, service } = setup();
    const completed = { ...run, provider: "IFOOD", status: "COMPLETED" };
    prisma.salesImportRun.findFirst.mockResolvedValue(completed);
    await expect(service.confirm("tenant", "run")).resolves.toBe(completed);
    expect(prisma.externalSalesMovement.findMany).not.toHaveBeenCalled();
    expect(historical.importNormalizedSale).not.toHaveBeenCalled();
  });

  describe("reconcileKnownSales (automatic import)", () => {
    const sale = (overrides: Record<string, unknown> = {}) => ({
      provider: "MERCADO_PAGO",
      channel: "API",
      providerMovementId: "m-1",
      externalSaleId: "sale-1",
      occurredAt: "2026-11-16T15:00:00.000Z",
      grossAmount: 20,
      feeAmount: 0.4,
      netAmount: 19.6,
      expectedReleaseAt: "2026-11-17T15:00:00.000Z",
      paymentMethod: "PIX",
      ...overrides,
    });
    const reconcileSetup = (order: Record<string, unknown>) => {
      const prisma = {
        externalSaleIdentity: {
          findMany: vi.fn().mockResolvedValue([{ externalSaleId: "sale-1", orderId: "order-1" }]),
        },
        order: {
          findMany: vi.fn().mockResolvedValue([{ id: "order-1", ...order }]),
          update: vi.fn().mockResolvedValue({}),
        },
      };
      const service = new SalesImportConfirmationService(prisma as never, {} as never, {} as never);
      return { prisma, service };
    };
    const synced = {
      paymentGrossAmount: "20.00",
      paymentFeeAmount: "0.40",
      paymentNetAmount: "19.60",
      paymentReleaseExpectedAt: new Date("2026-11-17T15:00:00.000Z"),
      paymentReleaseSource: "EXTRACT",
    };

    it("does not write the order when nothing changed", async () => {
      const { prisma, service } = reconcileSetup(synced);
      const updated = await service.reconcileKnownSales(
        "tenant",
        { provider: "MERCADO_PAGO", environment: "PRODUCTION" },
        [{ externalSaleId: "sale-1", sale: sale() as never }]
      );
      expect(updated).toBe(0);
      expect(prisma.order.update).not.toHaveBeenCalled();
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: "tenant", id: { in: ["order-1"] } } })
      );
    });

    it("writes the order when the provider reports a new fee or release date", async () => {
      const { prisma, service } = reconcileSetup({ ...synced, paymentFeeAmount: null, paymentNetAmount: null });
      const updated = await service.reconcileKnownSales(
        "tenant",
        { provider: "MERCADO_PAGO", environment: "PRODUCTION" },
        [{ externalSaleId: "sale-1", sale: sale() as never }]
      );
      expect(updated).toBe(1);
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: "order-1" },
        data: expect.objectContaining({ paymentFeeAmount: 0.4, paymentNetAmount: 19.6 }),
      });
    });

    it("skips sales without a linked order and does nothing for an empty list", async () => {
      const { prisma, service } = reconcileSetup(synced);
      prisma.externalSaleIdentity.findMany.mockResolvedValue([]);
      prisma.order.findMany.mockResolvedValue([]);
      expect(
        await service.reconcileKnownSales("tenant", { provider: "PAGBANK", environment: "PRODUCTION" }, [
          { externalSaleId: "sale-1", sale: sale() as never },
        ])
      ).toBe(0);
      expect(
        await service.reconcileKnownSales("tenant", { provider: "PAGBANK", environment: "PRODUCTION" }, [])
      ).toBe(0);
      expect(prisma.order.update).not.toHaveBeenCalled();
    });
  });
});
