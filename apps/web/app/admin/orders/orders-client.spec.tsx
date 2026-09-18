import React, { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KdsOrder } from "@rrfive/types";
import { OrdersClient } from "./orders-client";
import {
  confirmPlatformOrder,
  refusePlatformOrder,
  getPlatformCancellationReasons,
  updateKdsOrderStatus,
} from "../../../lib/api";

const socket = { on: vi.fn(), disconnect: vi.fn() };
vi.mock("socket.io-client", () => ({ io: vi.fn(() => socket) }));
vi.mock("../../../lib/adaptive-polling", () => ({ useAdaptivePolling: vi.fn() }));
vi.mock("../../../lib/api", () => ({
  getKdsOrders: vi.fn().mockResolvedValue([]),
  updateKdsOrderStatus: vi.fn(),
  confirmPlatformOrder: vi.fn(),
  refusePlatformOrder: vi.fn(),
  getPlatformCancellationReasons: vi.fn().mockResolvedValue([]),
  claimOperationalAssignment: vi.fn(),
  getOperationalAssignees: vi.fn().mockResolvedValue([]),
  transferOperationalAssignment: vi.fn(),
  getManualPaymentOptions: vi.fn().mockResolvedValue([]),
}));

const updateKdsOrderStatusMock = vi.mocked(updateKdsOrderStatus);
const confirmPlatformOrderMock = vi.mocked(confirmPlatformOrder);
const refusePlatformOrderMock = vi.mocked(refusePlatformOrder);
const getPlatformCancellationReasonsMock = vi.mocked(getPlatformCancellationReasons);

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

describe("OrdersClient keyboard shortcuts", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    socket.on.mockReturnValue(socket);
    updateKdsOrderStatusMock.mockReset();
    confirmPlatformOrderMock.mockReset();
    refusePlatformOrderMock.mockReset();
    getPlatformCancellationReasonsMock.mockReset();
    getPlatformCancellationReasonsMock.mockResolvedValue([
      { id: "501", description: "Item indisponivel" },
    ]);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("highlights the selected card and shows its queue position on Tab", async () => {
    await renderInteractive([
      counterOrder({ id: "order-a" }),
      counterOrder({ id: "order-b", nextStatuses: ["READY", "CANCELLED"], status: "PREPARING" }),
    ]);

    pressKey("Tab");

    expect(container.textContent).toContain("Selecionado - 1/2");
    expect(document.activeElement?.getAttribute("aria-label")).toContain("selecionado");
  });

  it("advances a normal order on F2 and moves the selection to the next order", async () => {
    const a = counterOrder({ id: "order-a" });
    const b = counterOrder({ id: "order-b", nextStatuses: ["READY", "CANCELLED"], status: "PREPARING" });
    updateKdsOrderStatusMock.mockResolvedValue({
      ...a,
      nextStatuses: ["READY", "CANCELLED"],
      status: "PREPARING",
    });
    await renderInteractive([a, b]);

    pressKey("Tab");
    await pressKeyAsync("F2");

    expect(updateKdsOrderStatusMock).toHaveBeenCalledWith("order-a", {
      status: "PREPARING",
      expectedVersion: 0,
    });
    expect(container.textContent).toContain("Selecionado - 2/2");
  });

  it("accepts a pending iFood order on F2", async () => {
    const pending = ifoodOrder();
    confirmPlatformOrderMock.mockResolvedValue(pending);
    await renderInteractive([pending]);

    pressKey("Tab");
    await pressKeyAsync("F2");

    expect(confirmPlatformOrderMock).toHaveBeenCalledWith("token", pending.id);
  });

  it("ignores a second F2 while the first status change is still in flight", async () => {
    let resolveUpdate!: (value: KdsOrder) => void;
    updateKdsOrderStatusMock.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      })
    );
    const a = counterOrder({ id: "order-a" });
    await renderInteractive([a]);

    pressKey("Tab");
    pressKey("F2");
    pressKey("F2");

    expect(updateKdsOrderStatusMock).toHaveBeenCalledOnce();

    await act(async () => {
      resolveUpdate({ ...a, nextStatuses: ["READY", "CANCELLED"], status: "PREPARING" });
      await Promise.resolve();
    });
  });

  it("cancels a normal order after two F3 presses within the confirmation window", async () => {
    const a = counterOrder({ id: "order-a" });
    updateKdsOrderStatusMock.mockResolvedValue({ ...a, status: "CANCELLED" });
    await renderInteractive([a]);

    pressKey("Tab");
    pressKey("F3");
    expect(container.textContent).toContain("Aperte F3 novamente");
    expect(updateKdsOrderStatusMock).not.toHaveBeenCalled();

    await pressKeyAsync("F3");

    expect(updateKdsOrderStatusMock).toHaveBeenCalledWith("order-a", {
      status: "CANCELLED",
      expectedVersion: 0,
    });
  });

  it("opens the refuse-reason form (without submitting) after two F3 presses on a pending iFood order", async () => {
    const pending = ifoodOrder();
    await renderInteractive([pending]);

    pressKey("Tab");
    pressKey("F3");
    await pressKeyAsync("F3");

    expect(getPlatformCancellationReasonsMock).toHaveBeenCalledWith("token", pending.id);
    expect(refusePlatformOrderMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Item indisponivel");
    expect(container.querySelector('input[placeholder="Complemento do motivo"]')).not.toBeNull();
  });

  it("opens the checkout dialog on F4 for an eligible order", async () => {
    await renderInteractive([counterOrder({ id: "order-a", serviceTabId: null })]);

    pressKey("Tab");
    await pressKeyAsync("F4");

    expect(container.querySelector('[aria-label="Fechar checkout"]')).not.toBeNull();
  });

  it("does nothing on F4 for an order linked to a comanda", async () => {
    await renderInteractive([counterOrder({ id: "order-a", serviceTabId: "tab-1" })]);

    pressKey("Tab");
    pressKey("F4");

    expect(container.querySelector('[aria-label="Fechar checkout"]')).toBeNull();
  });

  async function renderInteractive(orders: KdsOrder[]) {
    await act(async () => {
      root.render(
        <OrdersClient
          apiUrl="http://localhost:3001"
          initialActiveOrders={orders}
          initialHistoryOrders={[]}
          tenantId="tenant-1"
          token="token"
        />
      );
    });
  }

  function pressKey(key: string, options: KeyboardEventInit = {}) {
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options })
      );
    });
  }

  async function pressKeyAsync(key: string, options: KeyboardEventInit = {}) {
    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options })
      );
      await Promise.resolve();
      await Promise.resolve();
    });
  }
});

function counterOrder(overrides: Partial<KdsOrder> = {}): KdsOrder {
  return {
    id: "order-c1",
    source: "COUNTER",
    publicCode: "201",
    version: 0,
    ageSeconds: 60,
    overdue: false,
    nextStatuses: ["PREPARING", "CANCELLED"],
    status: "PENDING",
    total: "20.00",
    customerName: "Cliente Balcao",
    customerPhone: "11888888888",
    fulfillmentMethod: "PICKUP",
    paymentMethod: "CASH",
    paymentInstitution: null,
    platformProvider: null,
    notes: null,
    items: [],
    ...overrides,
  };
}

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
