import { afterEach, describe, expect, it, vi } from "vitest";
import { ifoodSalesFixture } from "./__fixtures__/ifood-financial.fixtures";
import { IfoodFinancialClient } from "./ifood-financial.client";
import { SalesProviderError } from "../sales-provider.adapter";

function client() {
  return new IfoodFinancialClient({
    get: vi.fn((key: string) =>
      key === "IFOOD_FINANCIAL_BASE_URL" ? "https://financial.example/financial" : 50
    ),
  } as never);
}

afterEach(() => vi.unstubAllGlobals());

describe("IfoodFinancialClient", () => {
  it("starts at page zero and completes pageCount pages", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...ifoodSalesFixture, pageCount: 2, total: 2 }), {
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ...ifoodSalesFixture,
            page: 1,
            pageCount: 2,
            total: 2,
            sales: [{ ...ifoodSalesFixture.sales[0], id: "sale-2" }],
          }),
          { status: 200 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);
    const result = await client().fetchSales({
      accessToken: "token",
      merchantId: "merchant",
      startDate: "2026-09-01",
      endDate: "2026-09-01",
    });
    expect(
      fetchMock.mock.calls.map(([url]) => new URL(String(url)).searchParams.get("page"))
    ).toEqual(["0", "1"]);
    expect(result).toMatchObject({ pagesFetched: 2, totalPages: 2, totalElements: 2 });
    expect(result.sales).toHaveLength(2);
  });

  it("rejects invalid and over-90-day periods before the request", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await expect(
      client().fetchSales({
        accessToken: "token",
        merchantId: "merchant",
        startDate: "2026-01-01",
        endDate: "2026-04-01",
      })
    ).rejects.toBeInstanceOf(RangeError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    [401, "AUTHENTICATION", false],
    [403, "AUTHENTICATION", false],
    [429, "RATE_LIMIT", true],
    [500, "UNAVAILABLE", true],
  ] as const)("maps HTTP %s safely", async (status, code, retryable) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status, headers: { "retry-after": "0" } }))
    );
    const promise = client().fetchSales({
      accessToken: "secret-token",
      merchantId: "merchant",
      startDate: "2026-09-01",
      endDate: "2026-09-01",
    });
    await expect(promise).rejects.toMatchObject({ code, retryable });
    await expect(promise).rejects.not.toThrow("secret-token");
  });

  it("maps exhausted network timeouts as retryable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("timeout", "TimeoutError")));
    await expect(
      client().fetchSales({
        accessToken: "token",
        merchantId: "merchant",
        startDate: "2026-09-01",
        endDate: "2026-09-01",
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<SalesProviderError>>({ code: "TIMEOUT", retryable: true })
    );
  });
});
