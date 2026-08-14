/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { mercadoPagoApprovedPaymentFixture } from "./__fixtures__/mercado-pago.fixtures";
import { MercadoPagoSalesProviderAdapter } from "./mercado-pago-sales-provider.adapter";

describe("MercadoPagoSalesProviderAdapter", () => {
  it("fetches the interval once and distributes daily evidence", async () => {
    const client: any = {
      searchPayments: vi.fn().mockResolvedValue([
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

  it("keeps non-sale evidence without preventing later sales in the interval", async () => {
    const client: any = {
      searchPayments: vi.fn().mockResolvedValue([
        {
          ...mercadoPagoApprovedPaymentFixture,
          id: 1,
          operation_type: "money_transfer",
          money_release_date: "2026-07-01T10:00:00Z",
        },
        {
          ...mercadoPagoApprovedPaymentFixture,
          id: 2,
          operation_type: "pos_payment",
          money_release_date: "2026-07-02T10:00:00Z",
        },
      ]),
    };

    const result = await new MercadoPagoSalesProviderAdapter(client).fetchRange({
      startDate: "2026-07-01",
      endDate: "2026-07-02",
      merchantId: "",
      credential: "token",
    });

    expect(result.days[0].movements[0]).toMatchObject({
      kind: "NON_SALE",
      sale: null,
      rejectionCode: "NON_SALE_OPERATION",
    });
    expect(result.days[1].movements[0]).toMatchObject({ kind: "SALE" });
    expect(result.days[1].movements[0].sale).not.toBeNull();
  });
});
