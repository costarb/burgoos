import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TabsClient } from "./tabs-client";

describe("TabsClient", () => {
  it("renders open, balance and checkout-oriented tab controls", () => {
    const html = renderToStaticMarkup(
      <TabsClient
        initialTabs={[{
          id: "tab-1",
          number: "12",
          displayName: "Joao",
          publicCode: "C0012",
          status: "OPEN",
          assignedUserId: null,
          grossTotal: "42.00",
          paidAmount: "10.00",
          openBalance: "32.00",
          version: 1,
          openedAt: "2026-07-23T12:00:00.000Z",
          closedAt: null,
        }]}
      />,
    );
    expect(html).toContain("Abrir comanda");
    expect(html).toContain("Comanda 12");
    expect(html).toContain("R$ 32.00");
    expect(html).toContain("Aberta");
  });

  it("renders tab detail, linked orders and checkout action", () => {
    const summary = {
      id: "tab-1",
      number: "12",
      displayName: "Joao",
      publicCode: "C0012",
      status: "OPEN" as const,
      assignedUserId: null,
      grossTotal: "42.00",
      paidAmount: "10.00",
      openBalance: "32.00",
      version: 1,
      openedAt: "2026-07-23T12:00:00.000Z",
      closedAt: null,
    };
    const html = renderToStaticMarkup(
      <TabsClient
        initialSelected={{
          ...summary,
          notes: null,
          charges: [],
          orders: [{
            id: "order-1",
            publicCode: "101",
            serviceTabId: "tab-1",
            source: "COUNTER",
            status: "PENDING",
            paymentStatus: "UNPAID",
            fulfillmentMethod: "PICKUP",
            total: "42.00",
            customerName: "Joao",
            customerPhone: null,
            assignedUserId: null,
            version: 0,
            createdAt: "2026-07-23T12:01:00.000Z",
            items: [],
          }],
        }}
        initialTabs={[summary]}
      />,
    );
    expect(html).toContain("#101");
    expect(html).toContain("Adicionar pedido");
    expect(html).toContain("Bloquear comanda para pagamento");
    expect(html).toContain("/admin/pos?tabId=tab-1");
    expect(html).toContain("R$ 32.00");
  });

  it("makes the pending-payment state explicit without pretending a payment was recorded", () => {
    const html = renderToStaticMarkup(
      <TabsClient
        initialSelected={{
          id: "tab-2",
          number: "15",
          displayName: null,
          publicCode: "C0015",
          status: "CHECKOUT_PENDING",
          assignedUserId: null,
          grossTotal: "30.00",
          paidAmount: "0.00",
          openBalance: "30.00",
          version: 2,
          openedAt: "2026-07-23T12:00:00.000Z",
          closedAt: null,
          notes: null,
          charges: [],
          orders: [],
        }}
        initialTabs={[]}
      />,
    );
    expect(html).toContain("Aguardando pagamento");
    expect(html).toContain("Saldo a cobrar: R$ 30.00");
    expect(html).toContain("Reabrir para adicionar pedidos");
  });
});
