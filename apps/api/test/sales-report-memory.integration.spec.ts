import { OrderStatus, Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { SalesReportService } from "../src/management/reports/sales-report.service";
import { parseSalesReportQuery } from "../src/management/reports/sales-report.types";

describe("sales report bounded database aggregation", () => {
  it("keeps aggregate dimensions equivalent while loading only the requested analytical page", async () => {
    const row = (key: string | null, count: number, gross: string) => ({
      dimensionKey: key,
      orderCount: BigInt(count),
      grossRevenue: new Prisma.Decimal(gross),
      acquiredNetRevenue: new Prisma.Decimal(gross),
      releasedNetRevenue: new Prisma.Decimal(gross),
      receivableNetAmount: new Prisma.Decimal(0),
      paymentFeeAmount: new Prisma.Decimal(0),
    });
    const prisma = {
      $queryRaw: vi.fn()
        .mockResolvedValueOnce([{ ...row(null, 3, "60"), pendingOrderCount: 0n }])
        .mockResolvedValueOnce([row("2026-08-01", 1, "10"), row("2026-08-02", 2, "50")])
        .mockResolvedValueOnce([row("MERCADO_PAGO", 2, "50"), row("CAIXA_LOCAL", 1, "10")])
        .mockResolvedValueOnce([row("PIX", 2, "50"), row("CASH", 1, "10")])
        .mockResolvedValueOnce([{ ...row("platform-1", 3, "60"), dimensionLabel: "Delivery" }]),
      order: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(3),
      },
    };
    const service = new SalesReportService(prisma as never);
    const report = await service.getReport("11111111-1111-4111-8111-111111111111", parseSalesReportQuery({
      start: "2026-08-01",
      end: "2026-08-02",
      status: OrderStatus.DELIVERED,
      page: "2",
      pageSize: "1",
    }));

    expect(report.summary).toMatchObject({ orderCount: 3, grossRevenue: "60.00" });
    expect(report.byPaymentInstitution.map(({ dimensionKey, grossRevenue }) => ({ dimensionKey, grossRevenue }))).toEqual([
      { dimensionKey: "MERCADO_PAGO", grossRevenue: "50.00" },
      { dimensionKey: "CAIXA_LOCAL", grossRevenue: "10.00" },
    ]);
    expect(report.byPaymentMethod).toEqual(expect.arrayContaining([
      expect.objectContaining({ dimensionKey: "PIX", orderCount: 2 }),
      expect.objectContaining({ dimensionKey: "CASH", orderCount: 1 }),
    ]));
    expect(report.daily).toHaveLength(2);
    expect(prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 1, take: 1 }));
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(5);
  });
});
