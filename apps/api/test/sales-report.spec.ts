import { OrderStatus, PaymentInstitution, PaymentMethod, Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { SalesReportService } from "../src/management/reports/sales-report.service";
import { parseSalesReportQuery } from "../src/management/reports/sales-report.types";

const tenantId = "11111111-1111-4111-8111-111111111111";
const platformId = "22222222-2222-4222-8222-222222222222";

describe("sales report service", () => {
  it("aggregates money, net fallback, zero-sale days and dimensions", async () => {
    const prismaMock = {
      order: {
        findMany: vi.fn().mockResolvedValue([
          order({
            id: "33333333-3333-4333-8333-333333333333",
            createdAt: new Date("2026-05-30T21:00:00.000Z"),
            total: "30.00",
            paymentGrossAmount: "30.00",
            paymentFeeAmount: "1.50",
            paymentNetAmount: "28.50",
            paymentInstitution: PaymentInstitution.MERCADO_PAGO,
            paymentMethod: PaymentMethod.CREDIT_CARD,
          }),
          order({
            id: "44444444-4444-4444-8444-444444444444",
            createdAt: new Date("2026-06-01T18:00:00.000Z"),
            total: "20.00",
            paymentGrossAmount: null,
            paymentFeeAmount: null,
            paymentNetAmount: null,
            paymentInstitution: PaymentInstitution.CAIXA_LOCAL,
            paymentMethod: PaymentMethod.CASH,
            externalPaymentId: null,
          }),
        ]),
        count: vi.fn().mockResolvedValue(2),
      },
    };
    const service = new SalesReportService(prismaMock as never);

    const report = await service.getReport(
      tenantId,
      parseSalesReportQuery({ start: "2026-05-30", end: "2026-06-01" })
    );

    expect(report.summary).toMatchObject({
      orderCount: 2,
      grossRevenue: "50.00",
      acquiredNetRevenue: "48.50",
      paymentFeeAmount: "1.50",
      averageTicket: "25.00",
    });
    expect(report.daily).toHaveLength(3);
    expect(report.daily[1]).toMatchObject({
      date: "2026-05-31",
      orderCount: 0,
      grossRevenue: "0.00",
    });
    expect(report.byPaymentInstitution).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dimensionKey: "MERCADO_PAGO",
          dimensionLabel: "Mercado Pago",
          shareOfGrossRevenue: 0.6,
        }),
        expect.objectContaining({
          dimensionKey: "CAIXA_LOCAL",
          dimensionLabel: "Caixa local",
          shareOfGrossRevenue: 0.4,
        }),
      ])
    );
    expect(report.analytical.items[0]).toMatchObject({
      externalPaymentId: "ext-33333333-3333-4333-8333-333333333333",
      imported: true,
      assignedProducts: [{ quantity: 1, productName: "X-BURGUER" }],
    });
    expect(report.analytical.items[1]).toMatchObject({
      acquiredNetAmount: "20.00",
      imported: false,
    });
  });

  it("builds default delivered filter and validates enum values", () => {
    expect(() => parseSalesReportQuery({ paymentMethod: "BOLETO" })).toThrow("paymentMethod");
    expect(() => parseSalesReportQuery({ start: "2026-06-02", end: "2026-06-01" })).toThrow(
      "Data inicial"
    );
  });
});

function order(overrides: {
  id: string;
  createdAt: Date;
  total: string;
  paymentGrossAmount: string | null;
  paymentFeeAmount: string | null;
  paymentNetAmount: string | null;
  paymentInstitution: PaymentInstitution | null;
  paymentMethod: PaymentMethod;
  externalPaymentId?: string | null;
}) {
  return {
    id: overrides.id,
    tenantId,
    status: OrderStatus.DELIVERED,
    total: decimal(overrides.total),
    customerName: "Cliente",
    customerPhone: "11999999999",
    fulfillmentMethod: "PICKUP",
    deliveryAddress: null,
    paymentMethod: overrides.paymentMethod,
    paymentInstitution: overrides.paymentInstitution,
    externalPaymentId:
      overrides.externalPaymentId === undefined ? `ext-${overrides.id}` : overrides.externalPaymentId,
    paymentGrossAmount: overrides.paymentGrossAmount ? decimal(overrides.paymentGrossAmount) : null,
    paymentFeeAmount: overrides.paymentFeeAmount ? decimal(overrides.paymentFeeAmount) : null,
    paymentNetAmount: overrides.paymentNetAmount ? decimal(overrides.paymentNetAmount) : null,
    paymentBrand: "Visa",
    orderPlatformId: platformId,
    notes: null,
    createdAt: overrides.createdAt,
    updatedAt: overrides.createdAt,
    orderPlatform: {
      id: platformId,
      tenantId,
      name: "FOOD_TRUCK",
      feeRate: decimal("0.0000"),
      paymentFeeRate: decimal("0.0000"),
      active: true,
      createdAt: overrides.createdAt,
      updatedAt: overrides.createdAt,
    },
    items: [
      {
        id: `item-${overrides.id}`,
        tenantId,
        orderId: overrides.id,
        productId: "55555555-5555-4555-8555-555555555555",
        productNameSnapshot: "X-BURGUER",
        quantity: 1,
        unitPrice: decimal(overrides.total),
        total: decimal(overrides.total),
      },
    ],
  };
}

function decimal(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}
