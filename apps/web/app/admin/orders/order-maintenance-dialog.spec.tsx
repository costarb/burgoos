import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AdminOrder } from "@burgoos/types";
import { OrderMaintenanceDialog } from "./order-maintenance-dialog";

const order: AdminOrder = {
  id: "order-1",
  status: "DELIVERED",
  total: "20.00",
  customerName: "Cliente",
  customerPhone: "11999999999",
  fulfillmentMethod: "PICKUP",
  paymentMethod: "PIX",
  paymentReleaseExpectedAt: "2026-06-05T12:00:00.000Z",
  notes: null,
  createdAt: "2026-06-03T12:00:00.000Z",
  updatedAt: "2026-06-03T12:00:00.000Z",
  items: [
    {
      id: "item-1",
      productId: "product-1",
      productNameSnapshot: "Produto",
      quantity: 1,
      unitPrice: "20.00",
      total: "20.00",
    },
  ],
};

describe("order maintenance dialog", () => {
  it("renders finalized-order warning and maintenance actions", () => {
    const html = renderToStaticMarkup(
      <OrderMaintenanceDialog
        onClose={vi.fn()}
        onDeleted={vi.fn()}
        onSaved={vi.fn()}
        order={order}
        token="token"
      />
    );

    expect(html).toContain("recalculara estoque e resultados financeiros");
    expect(html).toContain("Salvar alteracoes");
    expect(html).toContain("Excluir pedido");
    expect(html).toContain("Motivo da manutencao");
    expect(html).toContain("Data de liberacao");
  });
});
