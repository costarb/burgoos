import { OrderStatus, PaymentInstitution, PaymentMethod, Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { SalesReportService } from "../src/management/reports/sales-report.service";
import { parseSalesReportQuery } from "../src/management/reports/sales-report.types";

const tenantId = "11111111-1111-4111-8111-111111111111";
const platformId = "22222222-2222-4222-8222-222222222222";

describe("sales report service", () => {
  it("aggregates money, net fallback, zero-sale days and dimensions", async () => {
    const prismaMock = {
      $queryRaw: vi.fn()
        .mockResolvedValueOnce([aggregateRow({ orderCount: 2, gross: "50.00", net: "48.50", released: "28.50", receivable: "20.00", fee: "1.50", pendingOrderCount: 1, nextExpectedReleaseDate: new Date("2099-08-01T18:00:00.000Z") })])
        .mockResolvedValueOnce([
          aggregateRow({ key: "2026-05-30", gross: "30.00", net: "28.50", released: "28.50", fee: "1.50" }),
          aggregateRow({ key: "2026-06-01", gross: "20.00", net: "20.00", receivable: "20.00" }),
        ])
        .mockResolvedValueOnce([
          aggregateRow({ key: "MERCADO_PAGO", gross: "30.00", net: "28.50", released: "28.50", fee: "1.50" }),
          aggregateRow({ key: "CAIXA_LOCAL", gross: "20.00", net: "20.00", receivable: "20.00" }),
        ])
        .mockResolvedValueOnce([
          aggregateRow({ key: "CREDIT_CARD", gross: "30.00", net: "28.50", released: "28.50", fee: "1.50" }),
          aggregateRow({ key: "CASH", gross: "20.00", net: "20.00", receivable: "20.00" }),
        ])
        .mockResolvedValueOnce([
          { ...aggregateRow({ key: platformId, gross: "50.00", net: "48.50", released: "28.50", receivable: "20.00", fee: "1.50", orderCount: 2 }), dimensionLabel: "FOOD_TRUCK" },
        ]),
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
            paymentReleaseExpectedAt: new Date("2026-05-31T21:00:00.000Z"),
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
            paymentReleaseExpectedAt: new Date("2099-08-01T18:00:00.000Z"),
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
      releasedNetRevenue: "28.50",
      receivableNetAmount: "20.00",
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
      customerPhone: "11999999999",
      fulfillmentMethod: "PICKUP",
      total: "30.00",
      imported: true,
      assignedProducts: [
        expect.objectContaining({
          productId: "55555555-5555-4555-8555-555555555555",
          quantity: 1,
          productName: "X-BURGUER",
          unitPrice: "30.00",
          total: "30.00",
        }),
      ],
    });
    expect(report.analytical.items[1]).toMatchObject({
      acquiredNetAmount: "20.00",
      paymentReleaseStatus: "PENDING_RELEASE",
      imported: false,
    });
    expect(report.receivables).toEqual({
      pendingOrderCount: 1,
      receivableNetAmount: "20.00",
      nextExpectedReleaseDate: "2099-08-01",
    });
    expect(prismaMock.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 0,
      take: 50,
    }));
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
  paymentReleaseExpectedAt?: Date | null;
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
      overrides.externalPaymentId === undefined
        ? `ext-${overrides.id}`
        : overrides.externalPaymentId,
    paymentGrossAmount: overrides.paymentGrossAmount ? decimal(overrides.paymentGrossAmount) : null,
    paymentFeeAmount: overrides.paymentFeeAmount ? decimal(overrides.paymentFeeAmount) : null,
    paymentNetAmount: overrides.paymentNetAmount ? decimal(overrides.paymentNetAmount) : null,
    paymentBrand: "Visa",
    paymentReleaseExpectedAt: overrides.paymentReleaseExpectedAt ?? null,
    paymentReleaseSource: null,
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

function aggregateRow({
  key,
  orderCount = 1,
  gross = "0",
  net = "0",
  released = "0",
  receivable = "0",
  fee = "0",
  pendingOrderCount,
  nextExpectedReleaseDate,
}: {
  key?: string;
  orderCount?: number;
  gross?: string;
  net?: string;
  released?: string;
  receivable?: string;
  fee?: string;
  pendingOrderCount?: number;
  nextExpectedReleaseDate?: Date;
}) {
  return {
    dimensionKey: key,
    orderCount: BigInt(orderCount),
    grossRevenue: decimal(gross),
    acquiredNetRevenue: decimal(net),
    releasedNetRevenue: decimal(released),
    receivableNetAmount: decimal(receivable),
    paymentFeeAmount: decimal(fee),
    pendingOrderCount: pendingOrderCount === undefined ? undefined : BigInt(pendingOrderCount),
    nextExpectedReleaseDate,
  };
}
