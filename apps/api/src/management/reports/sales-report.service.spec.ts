/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { SalesReportService } from "./sales-report.service";
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
});
