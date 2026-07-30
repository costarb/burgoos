import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PosCatalog, PosOrder } from "@burgoos/types";
import {
  cartFromOrder,
  estimatedCartTotal,
  PendingPaymentItems,
  PendingPaymentOrderIdentification,
  PosClient,
} from "./pos-client";
import { normalizeOptionalChargedPrice } from "./item-customization-dialog";

const catalog: PosCatalog = {
  generatedAt: "2026-07-23T12:00:00.000Z",
  categories: [{
    id: "category-1",
    name: "Lanches",
    sortOrder: 0,
    products: [{
      id: "product-1",
      categoryId: "category-1",
      name: "Dogao",
      description: "",
      price: "20.00",
      imageUrl: null,
      active: true,
      ingredients: [{ id: "ingredient-1", name: "Cebola", removable: true }],
      complements: [{
        id: "complement-1",
        name: "Bacon",
        description: null,
        price: "4.50",
        maxQuantity: 2,
        active: true,
      }],
    }],
  }],
};

describe("PosClient", () => {
  it("keeps pending payments behind a compact notification", () => {
    const html = renderToStaticMarkup(
      <PosClient
        catalog={catalog}
        initialPendingPayments={[{
          id: "order-pending",
          publicCode: "123",
          customerName: "Maria",
          status: "READY",
          total: "25.00",
          paidAmount: "5.00",
          openBalance: "20.00",
          createdAt: "2026-07-24T12:00:00.000Z",
          items: [],
        }]}
      />,
    );
    expect(html).toContain("Pagamentos pendentes");
    expect(html).toContain(">1</span>");
    expect(html).not.toContain("#123");
    expect(html).not.toContain("Retomar cobrança");
  });

  it("shows order items and customizations in pending payment details", () => {
    const html = renderToStaticMarkup(
      <PendingPaymentItems items={[{
        id: "item-1",
        productName: "Dogao",
        quantity: 2,
        notes: "Caprichar no molho",
        modifications: [
          {
            id: "modification-1",
            type: "REMOVE_INGREDIENT",
            name: "Cebola",
            quantity: 1,
          },
          {
            id: "modification-2",
            type: "ADD_COMPLEMENT",
            name: "Bacon",
            quantity: 2,
          },
        ],
      }]} />,
    );

    expect(html).toContain("2× Dogao");
    expect(html).toContain("Sem Cebola");
    expect(html).toContain("+ 2 Bacon");
    expect(html).toContain("Obs.: Caprichar no molho");
  });

  it("highlights the order number in pending payment details", () => {
    const html = renderToStaticMarkup(
      <PendingPaymentOrderIdentification order={{
        id: "order-pending",
        publicCode: "123",
        customerName: "Maria",
        status: "READY",
        total: "25.00",
        paidAmount: "5.00",
        openBalance: "20.00",
        createdAt: "2026-07-24T12:00:00.000Z",
        items: [],
      }} />,
    );

    expect(html).toContain("bg-amber-100");
    expect(html).toContain("text-amber-950");
    expect(html).toContain("Pedido");
    expect(html).toContain("#123");
    expect(html).toContain("text-xl");
    expect(html).toContain("Maria");
  });

  it("renders touch capture, customization and price feedback", () => {
    const html = renderToStaticMarkup(<PosClient catalog={catalog} />);
    expect(html).toContain("Capturar pedido");
    expect(html).toContain("Dogao");
    expect(html).toContain("Personalizável");
    expect(html).toContain("Retirada / local");
    expect(html).toContain("O valor final será validado no servidor.");
  });

  it("estimates complements and manual prices", () => {
    const product = catalog.categories[0].products[0];
    expect(estimatedCartTotal([{
      key: "item-1",
      product,
      quantity: 2,
      modifications: [{ type: "ADD_COMPLEMENT", referenceId: "complement-1", quantity: 1 }],
    }])).toBe(49);
    expect(estimatedCartTotal([{
      key: "item-2",
      product,
      quantity: 1,
      chargedUnitPrice: "18.00",
      modifications: [],
    }])).toBe(18);
  });

  it("keeps a tab selected when capture starts from the tab detail", () => {
    const html = renderToStaticMarkup(
      <PosClient
        catalog={catalog}
        initialServiceTabId="tab-1"
        initialTabs={[{
          id: "tab-1",
          number: "12",
          displayName: "Joao",
          publicCode: "C0012",
          status: "OPEN",
          assignedUserId: null,
          grossTotal: "20.00",
          paidAmount: "0.00",
          openBalance: "20.00",
          version: 1,
          openedAt: "2026-07-23T12:00:00.000Z",
          closedAt: null,
        }]}
      />,
    );
    expect(html).toContain("Pedido vinculado à comanda");
    expect(html).toContain("comanda 12");
    expect(html).toContain('option value="tab-1" selected=""');
  });

  it("normalizes an optional manual price and omits the normal catalog price", () => {
    expect(normalizeOptionalChargedPrice("22", 20)).toBe("22.00");
    expect(normalizeOptionalChargedPrice("22,5", 20)).toBe("22.50");
    expect(normalizeOptionalChargedPrice("20,00", 20)).toBeUndefined();
    expect(normalizeOptionalChargedPrice("", 20)).toBeUndefined();
    expect(normalizeOptionalChargedPrice("R$ 22", 20)).toBeNull();
  });

  it("opens an existing order in POS edit mode with its customizations", () => {
    const order: PosOrder = {
      id: "order-1",
      publicCode: "123",
      serviceTabId: null,
      source: "COUNTER",
      status: "PENDING",
      paymentStatus: "UNPAID",
      fulfillmentMethod: "PICKUP",
      total: "20.00",
      customerName: "Balcao",
      customerPhone: null,
      assignedUserId: null,
      version: 2,
      notes: "Sem pressa",
      createdAt: "2026-07-24T12:00:00.000Z",
      items: [{
        id: "item-1",
        productId: "product-1",
        productNameSnapshot: "Dogao",
        quantity: 1,
        baseUnitPrice: "20.00",
        calculatedUnitPrice: "20.00",
        chargedUnitPrice: "20.00",
        total: "20.00",
        manualAdjustmentAmount: "0.00",
        manualAdjustmentReason: null,
        notes: null,
        modifications: [{
          id: "mod-1",
          type: "REMOVE_INGREDIENT",
          referenceId: "ingredient-1",
          nameSnapshot: "Cebola",
          quantity: 1,
          unitPriceDelta: "0.00",
          totalPriceDelta: "0.00",
        }],
      }],
    };

    const html = renderToStaticMarkup(<PosClient catalog={catalog} initialOrder={order} />);

    expect(html).toContain("Editar pedido 123");
    expect(html).toContain("Sem Cebola");
    expect(html).toContain("Salvar alterações no pedido");
    expect(cartFromOrder(catalog, order)[0].modifications[0].referenceId).toBe("ingredient-1");
  });
});
