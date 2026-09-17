/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { SalesReportService } from "./sales-report.service";
import { Prisma } from "@prisma/client";
import { parseSalesReportQuery } from "./sales-report.types";

describe("SalesReportService business date grouping", () => {
  it("converts UTC database timestamps to the Sao Paulo calendar day", async () => {
    const queryRaw = vi.fn().mockResolvedValue([]);
    const service = new SalesReportService({
      $queryRaw: queryRaw,
      order: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
    } as any);

    await service.getReport(
      "1b02924c-63ff-430a-a45d-df516a0bb5b4",
      parseSalesReportQuery({ start: "2026-08-13", end: "2026-08-13" })
    );

    const dailyQuery = queryRaw.mock.calls[1][0];
    expect(dailyQuery.strings.join("?")).toContain(
      "(o.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo'"
    );
  });

  it("calculates iFood receivables only from IFOOD liability payments", async () => {
    const queryRaw = vi.fn().mockResolvedValue([]);
    queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([])
      .mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([{
        saleCount: 2n,
        bagAmount: new Prisma.Decimal(100),
        customerPaidAmount: new Prisma.Decimal(110),
        saleBalanceAmount: new Prisma.Decimal(80),
        ifoodReceivableAmount: new Prisma.Decimal(70),
        storeReceivedAmount: new Prisma.Decimal(40),
      }]);
    const service = new SalesReportService({
      $queryRaw: queryRaw,
      order: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
      externalFinancialSale: { findMany: vi.fn() },
    } as any);
    const result = await service.getReport(
      "1b02924c-63ff-430a-a45d-df516a0bb5b4",
      parseSalesReportQuery({ start: "2026-09-01", end: "2026-09-30" })
    );
    expect(result.ifoodFinancial).toMatchObject({
      saleCount: 2,
      ifoodReceivableAmount: "70.00",
      storeReceivedAmount: "40.00",
    });
    const financialSql = queryRaw.mock.calls[5][0].strings.join("?");
    expect(financialSql).toContain("p.liability = 'IFOOD'");
    expect(financialSql).toContain("p.liability = 'STORE'");
  });
});
