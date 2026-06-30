import { describe, expect, it } from "vitest";
import { mapIfoodOrderToExternalDraft } from "./ifood-order-mapper";

describe("mapIfoodOrderToExternalDraft", () => {
  it("normalizes iFood order details into an external order draft", () => {
    const draft = mapIfoodOrderToExternalDraft({
      id: "order-1",
      status: "PLACED",
      createdAt: "2026-06-15T12:00:00.000Z",
      merchant: { id: "merchant-1" },
      customer: { name: "Ana", phone: "11999999999" },
      total: { orderAmount: 42.5 },
      items: [
        {
          id: "item-1",
          name: "Burger",
          quantity: 2,
          unitPrice: 20,
          totalPrice: 40,
          options: [{ name: "Sem cebola" }],
        },
      ],
      payments: { methods: [{ method: "PIX" }] },
    });

    expect(draft.externalOrderId).toBe("order-1");
    expect(draft.externalMerchantId).toBe("merchant-1");
    expect(draft.customerName).toBe("Ana");
    expect(draft.paymentMethod).toBe("PIX");
    expect(draft.items[0]).toMatchObject({
      externalItemId: "item-1",
      name: "Burger",
      quantity: 2,
      unitPrice: 20,
      notes: "Sem cebola",
    });
    expect(draft.confirmationDeadlineAt?.toISOString()).toBe("2026-06-15T12:08:00.000Z");
  });
});
