import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { ReportsService } from "./reports.service";

describe("ReportsService", () => {
  it("uses the Sao Paulo business-day window independently of the server timezone", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([
        { total: new Prisma.Decimal("10.00") },
        { total: new Prisma.Decimal("20.50") },
      ]);
    const service = new ReportsService({ order: { findMany } } as never);

    await expect(
      service.getDailySummary("tenant", new Date("2026-07-22T01:30:00.000Z"))
    ).resolves.toEqual({
      date: "2026-07-21",
      orderCount: 2,
      grossRevenue: "30.50",
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant",
          createdAt: {
            gte: new Date("2026-07-21T03:00:00.000Z"),
            lte: new Date("2026-07-22T02:59:59.999Z"),
          },
        }),
      })
    );
  });
});
