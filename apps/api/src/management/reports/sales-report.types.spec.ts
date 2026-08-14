import { describe, expect, it } from "vitest";
import { formatLocalDate, localDayEnd, localDayStart, parseSalesReportQuery } from "./sales-report.types";

describe("sales report business timezone", () => {
  it("builds Sao Paulo day boundaries independently from the server timezone", () => {
    expect(localDayStart("2026-07-20").toISOString()).toBe("2026-07-20T03:00:00.000Z");
    expect(localDayEnd("2026-07-20").toISOString()).toBe("2026-07-21T02:59:59.999Z");
  });

  it("limits interactive ranges to 92 days and directs larger periods to export", () => {
    expect(() => parseSalesReportQuery({ start: "2026-01-01", end: "2026-04-03" }))
      .toThrow(/no maximo 92 dias.*exportacao/i);
    expect(parseSalesReportQuery({ start: "2026-01-01", end: "2026-04-02" }))
      .toMatchObject({ start: "2026-01-01", end: "2026-04-02" });
  });

  it("uses a bounded 31-day rolling window when dates are omitted", () => {
    const parsed = parseSalesReportQuery({});
    const days = Math.round(
      (Date.parse(`${parsed.end}T12:00:00.000Z`) - Date.parse(`${parsed.start}T12:00:00.000Z`))
        / 86_400_000,
    ) + 1;
    expect(days).toBe(31);
  });

  it("groups UTC timestamps by their Sao Paulo calendar day", () => {
    expect(formatLocalDate(new Date("2026-07-21T00:00:42.000Z"))).toBe("2026-07-20");
    expect(formatLocalDate(new Date("2026-07-20T23:51:07.000Z"))).toBe("2026-07-20");
    expect(formatLocalDate(new Date("2026-07-21T03:00:11.000Z"))).toBe("2026-07-21");
  });
});
