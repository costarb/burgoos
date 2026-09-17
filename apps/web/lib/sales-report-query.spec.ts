import { describe, expect, it } from "vitest";
import { buildSalesReportSearchParams } from "./sales-report-query";

describe("buildSalesReportSearchParams", () => {
  it("serializes multi-select filters as repeated API query parameters", () => {
    const params = buildSalesReportSearchParams({
      start: "2026-09-01",
      end: "2026-09-04",
      paymentInstitutions: ["PAGBANK", "MERCADO_PAGO"],
      paymentMethods: ["PIX", "CASH", "PIX"],
      orderPlatformIds: ["platform-1", "platform-2"],
      statuses: ["DELIVERED", "CANCELLED"],
      page: 2,
      pageSize: 25,
    });

    expect(params.getAll("paymentInstitution")).toEqual(["PAGBANK", "MERCADO_PAGO"]);
    expect(params.getAll("paymentMethod")).toEqual(["PIX", "CASH"]);
    expect(params.getAll("orderPlatformId")).toEqual(["platform-1", "platform-2"]);
    expect(params.getAll("status")).toEqual(["DELIVERED", "CANCELLED"]);
    expect(params.get("start")).toBe("2026-09-01");
    expect(params.get("page")).toBe("2");
    expect(params.has("paymentMethods")).toBe(false);
  });

  it("omits empty multi-select filters", () => {
    const params = buildSalesReportSearchParams({ paymentMethods: [], statuses: [] });

    expect(params.toString()).toBe("");
  });
});
