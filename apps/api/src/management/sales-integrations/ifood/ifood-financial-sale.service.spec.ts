import { describe, expect, it, vi } from "vitest";
import { ifoodSalesFixture } from "./__fixtures__/ifood-financial.fixtures";
import { IfoodFinancialObservabilityService } from "./ifood-financial-observability.service";
import { IfoodFinancialSaleService } from "./ifood-financial-sale.service";

describe("IfoodFinancialSaleService", () => {
  it("upserts a canonical sale and replaces its payment children without changing the order", async () => {
    const prisma = {
      externalFinancialSale: {
        upsert: vi.fn().mockResolvedValue({ id: "financial-sale" }),
        findUnique: vi.fn().mockResolvedValue(null),
      },
      externalSalePayment: { deleteMany: vi.fn(), create: vi.fn() },
      order: { update: vi.fn() },
    };
    const service = new IfoodFinancialSaleService(prisma as never);
    await service.persist({
      tenantId: "tenant",
      integrationId: "integration",
      environment: "PRODUCTION",
      externalMerchantId: ifoodSalesFixture.sales[0].merchant.id,
      orderId: "operational-order",
      sale: {
        provider: "IFOOD",
        channel: "API",
        providerMovementId: ifoodSalesFixture.sales[0].id,
        externalSaleId: ifoodSalesFixture.sales[0].id,
        occurredAt: ifoodSalesFixture.sales[0].createdAt,
        grossAmount: 50,
        netAmount: 42,
        paymentMethod: "PIX",
        raw: structuredClone(ifoodSalesFixture.sales[0]) as never,
      },
    });
    expect(prisma.externalFinancialSale.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          orderId: "operational-order",
          bagAmount: expect.objectContaining({}),
          saleBalanceAmount: expect.objectContaining({}),
        }),
      })
    );
    expect(prisma.externalSalePayment.deleteMany).toHaveBeenCalledWith({
      where: { saleId: "financial-sale" },
    });
    expect(prisma.externalSalePayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          providerMethod: "PIX",
          mappedMethod: "PIX",
          liability: "IFOOD",
        }),
      })
    );
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it("persists multiple liabilities, installments and an unknown raw method", async () => {
    const raw = structuredClone(ifoodSalesFixture.sales[0]) as unknown as {
      payments: { methods: unknown[] };
    };
    raw.payments.methods.push({
      method: "CASH",
      value: 10,
      liability: "STORE",
      currency: "BRL",
      installment: {
        maxInstallments: 2,
        installmentDetail: [
          { reference: "1", amount: 5, expectedPaymentDate: "2026-09-10" },
          { reference: "2", amount: 5, expectedPaymentDate: "2026-10-10" },
        ],
      },
    });
    raw.payments.methods.push({ method: "FUTURE_PAY", value: 1, liability: "STORE" });
    const create = vi.fn();
    const service = new IfoodFinancialSaleService({
      externalFinancialSale: {
        upsert: vi.fn().mockResolvedValue({ id: "sale" }),
        findUnique: vi.fn().mockResolvedValue({ id: "sale" }),
      },
      externalSalePayment: { deleteMany: vi.fn(), create },
    } as never);
    await service.persist({
      tenantId: "tenant",
      integrationId: "integration",
      environment: "PRODUCTION",
      externalMerchantId: "merchant",
      orderId: "order",
      sale: {
        provider: "IFOOD",
        channel: "API",
        providerMovementId: "movement",
        externalSaleId: "external-sale",
        occurredAt: "2026-09-01T12:00:00Z",
        grossAmount: 50,
        paymentMethod: "PIX",
        raw,
      },
    });
    expect(create).toHaveBeenCalledTimes(3);
    expect(create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          mappedMethod: "CASH",
          liability: "STORE",
          installments: {
            create: [
              expect.objectContaining({ expectedPaymentDate: new Date("2026-09-10") }),
              expect.objectContaining({ expectedPaymentDate: new Date("2026-10-10") }),
            ],
          },
        }),
      })
    );
    expect(create).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ data: expect.objectContaining({ providerMethod: "FUTURE_PAY", mappedMethod: null }) })
    );
  });

  it("reports dedupe outcome to the observability service when provided", async () => {
    const observability = { dedupeChecked: vi.fn() } as unknown as IfoodFinancialObservabilityService;
    const prisma = {
      externalFinancialSale: {
        upsert: vi.fn().mockResolvedValue({ id: "financial-sale" }),
        findUnique: vi.fn().mockResolvedValue({ id: "financial-sale" }),
      },
      externalSalePayment: { deleteMany: vi.fn(), create: vi.fn() },
    };
    const service = new IfoodFinancialSaleService(prisma as never, observability);
    await service.persist({
      tenantId: "tenant",
      integrationId: "integration",
      environment: "PRODUCTION",
      externalMerchantId: "merchant",
      orderId: "order",
      sale: {
        provider: "IFOOD",
        channel: "API",
        providerMovementId: "movement",
        externalSaleId: "external-sale",
        occurredAt: "2026-09-01T12:00:00Z",
        grossAmount: 50,
        paymentMethod: "PIX",
        raw: structuredClone(ifoodSalesFixture.sales[0]) as never,
      },
    });
    expect(observability.dedupeChecked).toHaveBeenCalledWith({
      tenantId: "tenant",
      integrationId: "integration",
      externalSaleId: "external-sale",
      outcome: "UPDATED",
    });
  });
});
