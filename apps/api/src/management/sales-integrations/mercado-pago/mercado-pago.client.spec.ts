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
    });
    expect(payments.map((item) => item.id)).toEqual([1, 2]);
    expect(String(fetchMock.mock.calls[0][0])).toContain("criteria=asc");
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
});
