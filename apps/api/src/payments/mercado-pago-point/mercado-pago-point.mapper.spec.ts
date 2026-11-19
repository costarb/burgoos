import { describe, expect, it } from "vitest";
import { mapPointOrder } from "./mercado-pago-point.mapper";

describe("mapPointOrder", () => {
  it.each([
    ["created", "created", "CREATED"],
    ["action_required", "waiting_payment", "WAITING_CUSTOMER"],
    ["action_required", "check_on_terminal", "UNKNOWN"],
    ["at_terminal", "at_terminal", "PROCESSING"],
    ["processed", "accredited", "APPROVED"],
    ["failed", "rejected", "DECLINED"],
    ["cancelled", "cancelled", "CANCELLED"],
    ["expired", "expired", "EXPIRED"],
    ["processed", "partially_refunded", "PARTIALLY_REFUNDED"],
    ["refunded", "refunded", "REFUNDED"],
  ])("maps %s/%s to %s", (status, detail, expected) => {
    expect(mapPointOrder({ id: "order-1", status, status_detail: detail }).status).toBe(expected);
  });

  it.each([
    ["credit_card", "visa", "CREDIT_CARD"],
    ["debit_card", "debvisa", "DEBIT_CARD"],
    ["prepaid_card", "master", "DEBIT_CARD"],
    ["voucher_card", "alelo", "VOUCHER"],
    ["bank_transfer", "pix", "PIX"],
    ["qr", "pix", "PIX"],
    ["account_money", "account_money", "DIGITAL_WALLET"],
    ["something_new", "x", null],
  ])("maps the paid method %s/%s to %s", (type, id, expected) => {
    const mapped = mapPointOrder({
      id: "order-1",
      status: "processed",
      transactions: { payments: [{ id: "p-1", status: "processed", payment_method: { type, id } }] },
    });
    expect(mapped.paymentMethod).toBe(expected);
  });

  it("reports no method while the customer has not paid", () => {
    expect(mapPointOrder({ id: "order-1", status: "created" }).paymentMethod).toBeNull();
  });

  it("projects payment identifiers without exposing card digits", () => {
    const mapped = mapPointOrder({
      id: "order-1",
      status: "processed",
      transactions: {
        payments: [{
          id: "payment-1",
          status: "accredited",
          paid_amount: "25.00",
          card: { first_digits: "123456", last_digits: "1234" },
        }],
      },
    });
    expect(mapped).toMatchObject({ providerTransactionId: "payment-1", paidAmount: "25.00" });
    expect(JSON.stringify(mapped)).not.toContain("123456");
  });
});
