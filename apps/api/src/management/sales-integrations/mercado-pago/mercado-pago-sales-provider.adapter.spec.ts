/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { mercadoPagoApprovedPaymentFixture } from "./__fixtures__/mercado-pago.fixtures";
import { MercadoPagoSalesProviderAdapter } from "./mercado-pago-sales-provider.adapter";

describe("MercadoPagoSalesProviderAdapter", () => {
  it("fetches the interval once and distributes daily evidence", async () => {
    const client: any = {
      searchPayments: vi
        .fn()
        .mockResolvedValue([
          {
            ...mercadoPagoApprovedPaymentFixture,
            date_created: "2026-06-30T10:00:00Z",
            money_release_date: "2026-07-02T10:00:00Z",
          },
        ]),
    };
    const result = await new MercadoPagoSalesProviderAdapter(client).fetchRange({
      startDate: "2026-07-01",
      endDate: "2026-07-03",
      merchantId: "",
      credential: "token",
    });
    expect(client.searchPayments).toHaveBeenCalledTimes(1);
    expect(client.searchPayments).toHaveBeenCalledWith(
      expect.objectContaining({ rangeField: "money_release_date" })
    );
    expect(result.days).toHaveLength(3);
    expect(result.days[1].movements).toHaveLength(1);
  });
});
