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
});
