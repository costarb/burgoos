import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { OrderStatus, Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { SalesReportService } from "../src/management/reports/sales-report.service";

describe("POS migration compatibility", () => {
  it("keeps pre-existing orders valid with a LEGACY source default", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "../../packages/database/prisma/migrations/20260723090000_add_pos_kds_payments/migration.sql"),
      "utf8",
    );
    expect(migration).toContain('"source" "OrderSource" NOT NULL DEFAULT \'LEGACY\'');
    expect(migration).toContain('ADD COLUMN     "public_code" TEXT');
    expect(migration).not.toContain('ALTER COLUMN "public_code" SET NOT NULL');
  });

  it("includes historical orders in the existing sales report without requiring charges", async () => {
    const historicalOrder = {
      id: "legacy-order",
      tenantId: "tenant-1",
      createdAt: new Date("2026-07-18T12:00:00.000Z"),
      updatedAt: new Date("2026-07-18T12:00:00.000Z"),
      status: OrderStatus.DELIVERED,
      total: new Prisma.Decimal("25.00"),
      paymentGrossAmount: new Prisma.Decimal("25.00"),
      paymentNetAmount: new Prisma.Decimal("24.00"),
      paymentFeeAmount: new Prisma.Decimal("1.00"),
      paymentReleaseExpectedAt: new Date("2026-07-18T12:00:00.000Z"),
      paymentReleaseSource: "EXTRACT",
      paymentInstitution: "PAGBANK",
      paymentMethod: "DEBIT_CARD",
      orderPlatformId: null,
      orderPlatform: null,
      externalPaymentId: "legacy-payment",
      paymentBrand: null,
      customerName: "Cliente legado",
      customerPhone: "",
      fulfillmentMethod: "DELIVERY",
      notes: null,
      items: [{
        id: "legacy-item",
        productId: null,
        productNameSnapshot: "Produto legado",
        quantity: 1,
        unitPrice: new Prisma.Decimal("25.00"),
        total: new Prisma.Decimal("25.00"),
      }],
    };
    const findMany = vi.fn().mockResolvedValue([historicalOrder]);
    const count = vi.fn().mockResolvedValue(1);
    const service = new SalesReportService({ order: { findMany, count } } as never);
    const report = await service.getReport("tenant-1", {
      start: "2026-07-18",
      end: "2026-07-18",
      periodStart: new Date("2026-07-18T00:00:00.000Z"),
      periodEnd: new Date("2026-07-18T23:59:59.999Z"),
      paymentInstitution: undefined,
      paymentMethod: undefined,
      orderPlatformId: undefined,
      status: OrderStatus.DELIVERED,
      page: 1,
      pageSize: 20,
    });

    expect(findMany.mock.calls[0][0].where).not.toHaveProperty("source");
    expect(report.summary.orderCount).toBe(1);
    expect(report.summary.grossRevenue).toBe("25.00");
    expect(report.analytical.items[0]).toMatchObject({
      orderId: "legacy-order",
      imported: true,
      grossAmount: "25.00",
    });
  });
});
