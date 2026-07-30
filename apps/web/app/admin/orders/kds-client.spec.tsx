import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { KdsOrder } from "@burgoos/types";
import { describe, expect, it } from "vitest";
import { KdsClient } from "./kds-client";

describe("KdsClient", () => {
  it("shows origin, public code, age, priority and contextual pickup actions", () => {
    const html = renderToStaticMarkup(
      <KdsClient
        apiUrl="http://localhost:3001"
        initialActiveOrders={[order()]}
        initialHistoryOrders={[]}
        tenantId="tenant-1"
        token="token"
      />,
    );

    expect(html).toContain("Balcão");
    expect(html).toContain("#101");
    expect(html).toContain("20 min");
    expect(html).toContain("ring-red-100");
    expect(html).toContain(">Entregue</button>");
    expect(html).not.toContain(">Saiu</button>");
    expect(html).toContain("Observações do pedido");
    expect(html).toContain("Cliente aguardando no balcão");
    expect(html).toContain("Obs. do item: Cortar ao meio");
  });
});

function order(): KdsOrder {
  return {
    id: "order-1",
    source: "COUNTER",
    publicCode: "101",
    version: 2,
    status: "READY",
    ageSeconds: 1200,
    overdue: true,
    nextStatuses: ["DELIVERED", "CANCELLED"],
    total: "13.00",
    customerName: "Balcao",
    customerPhone: "",
    fulfillmentMethod: "PICKUP",
    paymentMethod: "CASH",
    paymentInstitution: "CAIXA_LOCAL",
    notes: "Cliente aguardando no balcão",
    items: [{
      id: "item-1",
      productId: "product-1",
      productNameSnapshot: "Dogao",
      quantity: 1,
      unitPrice: "13.00",
      total: "13.00",
      notes: "Cortar ao meio",
      modifications: [],
    }],
  };
}
