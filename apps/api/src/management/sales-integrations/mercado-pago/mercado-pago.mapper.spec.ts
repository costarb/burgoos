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

  it("preserves the release instant and its provider offset", () => {
    const movement = mapMercadoPagoPayment({
      ...mercadoPagoApprovedPaymentFixture,
      date_created: "2026-07-18T22:50:48.000-04:00",
      money_release_date: "2026-07-20T20:04:47.000-04:00",
    });

    expect(movement.sale?.occurredAt).toBe("2026-07-21T00:04:47.000Z");
    expect(movement.sale?.expectedReleaseAt).toBe("2026-07-21T00:04:47.000Z");
    expect(movement.raw).toMatchObject({
      date_created: "2026-07-18T22:50:48.000-04:00",
      money_release_date: "2026-07-20T20:04:47.000-04:00",
    });
  });

  it("falls back to creation date when Mercado Pago does not provide a release date", () => {
    const movement = mapMercadoPagoPayment({
      ...mercadoPagoApprovedPaymentFixture,
      date_created: "2026-07-18T19:51:07.000-04:00",
      money_release_date: null,
    });

    expect(movement.sale?.occurredAt).toBe("2026-07-18T23:51:07.000Z");
    expect(movement.sale?.expectedReleaseAt).toBeUndefined();
  });

  it("moves a late -04:00 release to the following Sao Paulo calendar day", () => {
    const movement = mapMercadoPagoPayment({
      ...mercadoPagoApprovedPaymentFixture,
      money_release_date: "2026-07-18T23:00:11.000-04:00",
    });

    expect(movement.sale?.occurredAt).toBe("2026-07-19T03:00:11.000Z");
  });
});
