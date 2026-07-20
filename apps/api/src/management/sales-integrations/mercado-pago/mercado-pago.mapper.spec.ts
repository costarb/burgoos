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

  it.each([
    ["prepaid_card", "master", "CREDIT_CARD"],
    ["account_money", "account_money", "DIGITAL_WALLET"],
  ])("maps Mercado Pago payment type %s", (paymentType, paymentMethod, expected) => {
    const movement = mapMercadoPagoPayment({
      ...mercadoPagoApprovedPaymentFixture,
      payment_type_id: paymentType,
      payment_method_id: paymentMethod,
    });

    expect(movement.rejectionCode).toBeUndefined();
    expect(movement.sale?.paymentMethod).toBe(expected);
  });

  it("preserves Mercado Pago timestamps with their original provider offset", () => {
    const movement = mapMercadoPagoPayment({
      ...mercadoPagoApprovedPaymentFixture,
      date_created: "2026-07-18T22:50:48.000-04:00",
      money_release_date: "2026-07-18T23:11:38.000-04:00",
    });

    expect(movement.sale?.occurredAt).toBe("2026-07-18T22:50:48.000-04:00");
    expect(movement.sale?.expectedReleaseAt).toBe("2026-07-18T23:11:38.000-04:00");
    expect(movement.raw).toMatchObject({
      date_created: "2026-07-18T22:50:48.000-04:00",
      money_release_date: "2026-07-18T23:11:38.000-04:00",
    });
  });
});
