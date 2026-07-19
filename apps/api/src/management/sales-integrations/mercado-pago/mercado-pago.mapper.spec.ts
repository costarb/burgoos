/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { mercadoPagoApprovedPaymentFixture } from "./__fixtures__/mercado-pago.fixtures";
import { mapMercadoPagoPayment } from "./mercado-pago.mapper";

describe("mapMercadoPagoPayment", () => {
  it("maps approved values, fees and payment method without sensitive payer/card data", () => {
    const movement = mapMercadoPagoPayment({
      ...mercadoPagoApprovedPaymentFixture,
      payer: { email: "secret@example.test" },
      card: { last_four_digits: "1234" },
    } as any);
    expect(movement.kind).toBe("SALE");
    expect(movement.sale).toMatchObject({
      provider: "MERCADO_PAGO",
      paymentMethod: "PIX",
      grossAmount: 42.5,
      feeAmount: 0.85,
      netAmount: 41.65,
    });
    expect(JSON.stringify(movement.raw)).not.toContain("secret@example.test");
    expect(movement.raw).not.toHaveProperty("card");
  });
  it("classifies non-approved payments as non-sales", () => {
    expect(
      mapMercadoPagoPayment({ ...mercadoPagoApprovedPaymentFixture, status: "refunded" }).kind
    ).toBe("NON_SALE");
  });
});
