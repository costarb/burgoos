import { describe, expect, it, vi } from "vitest";
import { ifoodSalesFixture } from "./__fixtures__/ifood-financial.fixtures";
import { IfoodSalesProviderAdapter } from "./ifood-sales-provider.adapter";

describe("IfoodSalesProviderAdapter", () => {
  it("returns evidence for every requested business day, including empty days", async () => {
    const client = {
      fetchSales: vi.fn().mockResolvedValue({
        sales: ifoodSalesFixture.sales,
        pagesFetched: 3,
        totalPages: 3,
        totalElements: 1,
      }),
    };
    const result = await new IfoodSalesProviderAdapter(client as never).fetchRange({
      credential: "token",
      merchantId: ifoodSalesFixture.sales[0].merchant.id,
      startDate: "2026-09-01",
      endDate: "2026-09-03",
    });
    expect(result.days.map((day) => day.date)).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
    expect(result.days.every((day) => day.validated && day.pagesFetched === 3)).toBe(true);
    expect(result.days[0].movements).toHaveLength(1);
    expect(result.days[1].movements).toHaveLength(0);
  });

  it("passes the complete range once so pagination and overlapping IDs are centralized", async () => {
    const client = {
      fetchSales: vi.fn().mockResolvedValue({
        sales: [],
        pagesFetched: 2,
        totalPages: 2,
        totalElements: 0,
      }),
    };
    await new IfoodSalesProviderAdapter(client as never).fetchRange({
      credential: "token",
      merchantId: "merchant",
      startDate: "2026-09-01",
      endDate: "2026-09-10",
    });
    expect(client.fetchSales).toHaveBeenCalledTimes(1);
    expect(client.fetchSales).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: "2026-09-01", endDate: "2026-09-10" })
    );
  });
});
