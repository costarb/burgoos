import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { KdsOrder } from "@burgoos/types";
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

  it("renders the four operational statuses in one large-screen row", () => {
    const html = renderToStaticMarkup(
      <OrdersClient
        apiUrl="http://localhost:3001"
        initialActiveOrders={[]}
        initialHistoryOrders={[]}
        tenantId="tenant-1"
        token="token"
      />
    );
    expect(html).toContain("lg:grid-cols-4");
    expect(html.indexOf(">Novo<")).toBeLessThan(html.indexOf(">Saiu<"));
  });

  it("shows ingredient removals and complement additions for the kitchen", () => {
    const customizedOrder = ifoodOrder();
    customizedOrder.items[0].modifications = [
      {
        id: "remove-1",
        type: "REMOVE_INGREDIENT",
        nameSnapshot: "Cebola",
        quantity: 1,
        unitPriceDelta: "0.00",
        totalPriceDelta: "0.00",
      },
      {
        id: "add-1",
        type: "ADD_COMPLEMENT",
        nameSnapshot: "Bacon",
        quantity: 2,
        unitPriceDelta: "3.00",
        totalPriceDelta: "6.00",
      },
    ];

    const html = renderToStaticMarkup(
      <OrdersClient
        apiUrl="http://localhost:3001"
        initialActiveOrders={[customizedOrder]}
        initialHistoryOrders={[]}
        tenantId="tenant-1"
        token="token"
      />
    );

    expect(html).toContain("Sem Cebola");
    expect(html).toContain("Adicionar 2x Bacon");
  });

  it("sends editable counter orders to the POS editor", () => {
    const order = {
      ...ifoodOrder(),
      source: "COUNTER" as const,
      platformProvider: null,
    };
    const html = renderToStaticMarkup(
      <OrdersClient
        apiUrl="http://localhost:3001"
        initialActiveOrders={[order]}
        initialHistoryOrders={[]}
        tenantId="tenant-1"
        token="token"
      />,
    );

    expect(html).toContain(`/admin/pos?orderId=${order.id}`);
    expect(html).toContain("Alterar no PDV");
  });
});

function ifoodOrder(): KdsOrder {
  return {
    id: "order-1",
    source: "IFOOD",
    publicCode: "101",
    version: 0,
    ageSeconds: 120,
    overdue: false,
    nextStatuses: ["PREPARING", "CANCELLED"],
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
