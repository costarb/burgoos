/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, describe, expect, it, vi } from "vitest";
import { MercadoPagoClient } from "./mercado-pago.client";
import { mercadoPagoApprovedPaymentFixture } from "./__fixtures__/mercado-pago.fixtures";

describe("MercadoPagoClient payments", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("paginates in ascending order and deduplicates overlapping pages", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            paging: { total: 3 },
            results: [
              { ...mercadoPagoApprovedPaymentFixture, id: 2 },
              { ...mercadoPagoApprovedPaymentFixture, id: 1 },
            ],
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            paging: { total: 3 },
            results: [{ ...mercadoPagoApprovedPaymentFixture, id: 2 }],
          }),
          { status: 200 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);
    const client = new MercadoPagoClient({ get: vi.fn() } as any);
    const payments = await client.searchPayments({
      accessToken: "secret",
      startDate: "2026-07-01",
      endDate: "2026-07-02",
      limit: 2,
      collectorId: "3358508664",
    });
    expect(payments.map((item) => item.id)).toEqual([1, 2]);
    expect(String(fetchMock.mock.calls[0][0])).toContain("criteria=asc");
    const firstUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(firstUrl.searchParams.get("collector.id")).toBe("3358508664");
    expect(firstUrl.searchParams.get("range")).toBe("money_release_date");
    expect(firstUrl.searchParams.get("sort")).toBe("date_created");
    expect(firstUrl.searchParams.get("status")).toBe("approved");
    expect(firstUrl.searchParams.get("begin_date")).toBe("2026-07-01T00:00:00.000-04:00");
    expect(firstUrl.searchParams.get("end_date")).toBe("2026-07-02T23:59:59.999-04:00");
  });

  it("advances by the page size actually returned by Mercado Pago", async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) => ({
      ...mercadoPagoApprovedPaymentFixture,
      id: index + 1,
    }));
    const secondPage = Array.from({ length: 5 }, (_, index) => ({
      ...mercadoPagoApprovedPaymentFixture,
      id: index + 21,
    }));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ paging: { total: 25 }, results: firstPage }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ paging: { total: 25 }, results: secondPage }), {
          status: 200,
        })
      );
    vi.stubGlobal("fetch", fetchMock);
    const client = new MercadoPagoClient({} as never);

    const payments = await client.searchPayments({
      accessToken: "secret",
      startDate: "2026-07-01",
      endDate: "2026-07-02",
      limit: 50,
    });

    expect(payments).toHaveLength(25);
    expect(new URL(String(fetchMock.mock.calls[1][0])).searchParams.get("offset")).toBe("20");
  });
  it("rejects ranges of 365 days or more", async () => {
    const client = new MercadoPagoClient({ get: vi.fn() } as any);
    await expect(
      client.searchPayments({
        accessToken: "secret",
        startDate: "2025-01-01",
        endDate: "2026-01-01",
      })
    ).rejects.toBeInstanceOf(RangeError);
  });

  it("uses the platform-configured API base URL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ paging: { total: 0 }, results: [] }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);
    const client = new MercadoPagoClient({
      value: vi.fn().mockResolvedValue("https://mercado-pago.test/"),
    } as any);
    await client.searchPayments({
      accessToken: "secret",
      startDate: "2026-07-21",
      endDate: "2026-07-21",
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "https://mercado-pago.test/v1/payments/search"
    );
  });
});
