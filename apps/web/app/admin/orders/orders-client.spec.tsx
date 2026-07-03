import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AdminOrder } from "@burgoos/types";
import { OrdersClient } from "./orders-client";

describe("OrdersClient platform actions", () => {
  it("shows accept/refuse controls for pending iFood order", () => {
    const html = renderToStaticMarkup(
      <OrdersClient
        apiUrl="http://localhost:3001"
        initialActiveOrders={[ifoodOrder()]}
        initialHistoryOrders={[]}
        tenantId="tenant-1"
        token="token"
      />
    );

    expect(html).toContain("Aceitar iFood");
    expect(html).toContain("Recusar");
    expect(html).toContain("Dentro do prazo de aceite");
    expect(html).not.toContain(">Preparando</button>");
  });

  it("keeps finalized orders out of the operational queue", () => {
    const html = renderToStaticMarkup(
      <OrdersClient
        apiUrl="http://localhost:3001"
        initialActiveOrders={[]}
        initialHistoryOrders={[{ ...ifoodOrder(), id: "delivered-1", status: "DELIVERED" }]}
        tenantId="tenant-1"
        token="token"
      />
    );

    expect(html).not.toContain("Historico");
    expect(html).not.toContain("Sem pedidos finalizados.");
    expect(html).toContain("Consultar vendas");
  });
});

function ifoodOrder(): AdminOrder {
  return {
    id: "order-1",
    status: "PENDING",
    total: "42.00",
    customerName: "Cliente iFood",
    customerPhone: "11999999999",
    fulfillmentMethod: "DELIVERY",
    paymentMethod: "PIX",
    paymentInstitution: "MERCADO_PAGO",
    platformProvider: "IFOOD",
    externalOrderId: "ifood-order-1",
    externalMerchantId: "merchant-1",
    platformExternalStatus: "PLACED",
    platformConfirmationDeadlineAt: "2026-06-15T12:08:00.000Z",
    platformConfirmationState: "OK",
    notes: null,
    items: [
      {
        id: "item-1",
        productId: "product-1",
        productNameSnapshot: "Burger",
        quantity: 1,
        unitPrice: "42.00",
        total: "42.00",
      },
    ],
  };
}
