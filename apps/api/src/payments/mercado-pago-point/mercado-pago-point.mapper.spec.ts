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
