import { afterEach, describe, expect, it, vi } from "vitest";
import { ifoodFinancialEventsFixture } from "./__fixtures__/ifood-financial.fixtures";
import { IfoodFinancialClient } from "./ifood-financial.client";
import { mapIfoodFinancialEvent } from "./ifood-financial-reconciliation.mapper";

afterEach(() => vi.unstubAllGlobals());
const client = () =>
  new IfoodFinancialClient({
    get: vi.fn((key: string) =>
      key === "IFOOD_FINANCIAL_BASE_URL" ? "https://financial.example" : 50
    ),
  } as never);

describe("iFood Financial Events", () => {
  it("uses one-based pagination and follows all pages", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...ifoodFinancialEventsFixture, hasNextPage: true }), {
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...ifoodFinancialEventsFixture, page: 2 }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);
    const result = await client().fetchFinancialEvents({
      accessToken: "token",
      merchantId: "merchant",
      startDate: "2026-09-01",
      endDate: "2026-09-07",
    });
    expect(
      fetchMock.mock.calls.map(([url]) => new URL(String(url)).searchParams.get("page"))
    ).toEqual(["1", "2"]);
    expect(fetchMock.mock.calls[0]?.[0].toString()).toContain("size=500");
    expect(result).toMatchObject({ pagesFetched: 2 });
  });

  it("rejects windows over 33 days", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await expect(
      client().fetchFinancialEvents({
        accessToken: "token",
        merchantId: "merchant",
        startDate: "2026-01-01",
        endDate: "2026-02-03",
      })
    ).rejects.toBeInstanceOf(RangeError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("preserves signed values, transfer impact and expected payment date", () => {
    const mapped = mapIfoodFinancialEvent(ifoodFinancialEventsFixture.financialEvents[0]);
    expect(mapped).toMatchObject({
      amount: -12,
      hasTransferImpact: true,
      baseAmount: 50,
      feePercentage: 24,
      competence: "2026-09",
    });
    expect(mapped.expectedPaymentDate?.toISOString()).toBe("2026-09-09T00:00:00.000Z");
    expect(mapped.providerEventKey).toHaveLength(64);
  });
});
