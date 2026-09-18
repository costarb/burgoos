import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KdsOrder, OrderStatus } from "@rrfive/types";
import { useOrderQueueShortcuts } from "./use-order-queue-shortcuts";
import type { UseOrderQueueShortcutsResult } from "./use-order-queue-shortcuts";

const columns: OrderStatus[] = ["PENDING", "PREPARING", "READY", "SHIPPED"];

describe("useOrderQueueShortcuts", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("selects the first order on the first Tab, then advances/retreats", async () => {
    const orders = [order("a", "PENDING"), order("b", "PREPARING"), order("c", "READY")];
    const result = render(orders);

    pressKey("Tab");
    expect(result.current.selectedOrderId).toBe("a");

    pressKey("Tab");
    expect(result.current.selectedOrderId).toBe("b");

    pressKey("Shift+Tab");
    expect(result.current.selectedOrderId).toBe("a");
  });

  it("treats Space the same as Tab for navigation", () => {
    const orders = [order("a", "PENDING"), order("b", "PREPARING")];
    const result = render(orders);

    pressKey(" ");
    expect(result.current.selectedOrderId).toBe("a");
    pressKey(" ");
    expect(result.current.selectedOrderId).toBe("b");
  });

  it("jumps to the first order of a column with 1-4, ignoring empty columns", () => {
    const orders = [order("a", "PENDING"), order("b", "READY")];
    const result = render(orders);

    pressKey("3");
    expect(result.current.selectedOrderId).toBe("b");

    pressKey("2"); // PREPARING has no orders
    expect(result.current.selectedOrderId).toBe("b");

    pressKey("1");
    expect(result.current.selectedOrderId).toBe("a");
  });

  it("ignores Tab when focus is on a natively interactive element", () => {
    const orders = [order("a", "PENDING")];
    const result = render(orders);
    const button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();

    pressKey("Tab");
    expect(result.current.selectedOrderId).toBeNull();
    button.remove();
  });

  it("clears the selection with Escape", () => {
    const orders = [order("a", "PENDING")];
    const result = render(orders);

    pressKey("Tab");
    expect(result.current.selectedOrderId).toBe("a");

    pressKey("Escape");
    expect(result.current.selectedOrderId).toBeNull();
  });

  it("reconciles the selection to the closest valid order when it disappears", () => {
    const orders = [order("a", "PENDING"), order("b", "PREPARING"), order("c", "READY")];
    const result = render(orders);
    pressKey("Tab");
    pressKey("Tab");
    expect(result.current.selectedOrderId).toBe("b");

    rerender([order("a", "PENDING"), order("c", "READY")]);
    expect(result.current.selectedOrderId).toBe("c");

    rerender([]);
    expect(result.current.selectedOrderId).toBeNull();
  });

  it("calls onPrimaryAction for the selected order on F2, and ignores it without a selection", () => {
    const orders = [order("a", "PENDING")];
    const onPrimaryAction = vi.fn();
    render(orders, { onPrimaryAction });

    pressKey("F2");
    expect(onPrimaryAction).not.toHaveBeenCalled();

    pressKey("Tab");
    pressKey("F2");
    expect(onPrimaryAction).toHaveBeenCalledWith(orders[0]);
  });

  it("requires two F3 presses within the window to confirm, and shows a pending state meanwhile", async () => {
    vi.useFakeTimers();
    const orders = [order("a", "PENDING")];
    const onDestructiveAction = vi.fn();
    const result = render(orders, { onDestructiveAction });

    pressKey("Tab");
    pressKey("F3");
    expect(result.current.pendingCancelOrderId).toBe("a");
    expect(onDestructiveAction).not.toHaveBeenCalled();

    pressKey("F3");
    expect(onDestructiveAction).toHaveBeenCalledWith(orders[0]);
    expect(result.current.pendingCancelOrderId).toBeNull();
    vi.useRealTimers();
  });

  it("expires the pending F3 confirmation after the window elapses", () => {
    vi.useFakeTimers();
    const orders = [order("a", "PENDING")];
    const onDestructiveAction = vi.fn();
    const result = render(orders, { onDestructiveAction });

    pressKey("Tab");
    pressKey("F3");
    expect(result.current.pendingCancelOrderId).toBe("a");

    act(() => {
      vi.advanceTimersByTime(2001);
    });
    expect(result.current.pendingCancelOrderId).toBeNull();

    pressKey("F3");
    expect(onDestructiveAction).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("clears a pending F3 confirmation on Escape or selection change without confirming", () => {
    const orders = [order("a", "PENDING"), order("b", "PREPARING")];
    const onDestructiveAction = vi.fn();
    const result = render(orders, { onDestructiveAction });

    pressKey("Tab");
    pressKey("F3");
    expect(result.current.pendingCancelOrderId).toBe("a");

    pressKey("Escape");
    expect(result.current.pendingCancelOrderId).toBeNull();

    pressKey("Tab");
    pressKey("F3");
    expect(result.current.pendingCancelOrderId).toBe("a");

    pressKey("Tab"); // moves selection to "b"
    expect(result.current.pendingCancelOrderId).toBeNull();
    expect(onDestructiveAction).not.toHaveBeenCalled();
  });

  it("calls onCharge only when the selected order has no serviceTabId", () => {
    const eligible = order("a", "PENDING");
    const linked = { ...order("b", "PREPARING"), serviceTabId: "tab-1" };
    const onCharge = vi.fn();
    render([eligible, linked], { onCharge });

    pressKey("Tab");
    pressKey("F4");
    expect(onCharge).toHaveBeenCalledWith(eligible);

    pressKey("Tab");
    pressKey("F4");
    expect(onCharge).toHaveBeenCalledOnce();
  });

  it("ignores every shortcut while isInputBlocked is true", () => {
    const orders = [order("a", "PENDING")];
    const onPrimaryAction = vi.fn();
    const result = render(orders, { onPrimaryAction, isInputBlocked: true });

    pressKey("Tab");
    expect(result.current.selectedOrderId).toBeNull();
    pressKey("F2");
    expect(onPrimaryAction).not.toHaveBeenCalled();
  });

  let latestResult: UseOrderQueueShortcutsResult;

  function Harness({
    orders,
    isInputBlocked = false,
    onPrimaryAction = () => {},
    onDestructiveAction = () => {},
    onCharge = () => {},
  }: {
    orders: KdsOrder[];
    isInputBlocked?: boolean;
    onPrimaryAction?: (order: KdsOrder) => void;
    onDestructiveAction?: (order: KdsOrder) => void;
    onCharge?: (order: KdsOrder) => void;
  }) {
    latestResult = useOrderQueueShortcuts({
      orders,
      columns,
      isInputBlocked,
      onPrimaryAction,
      onDestructiveAction,
      onCharge,
    });
    return null;
  }

  function render(
    orders: KdsOrder[],
    options: {
      isInputBlocked?: boolean;
      onPrimaryAction?: (order: KdsOrder) => void;
      onDestructiveAction?: (order: KdsOrder) => void;
      onCharge?: (order: KdsOrder) => void;
    } = {}
  ) {
    act(() => {
      root.render(<Harness orders={orders} {...options} />);
    });
    return {
      get current() {
        return latestResult;
      },
    };
  }

  function rerender(orders: KdsOrder[]) {
    act(() => {
      root.render(<Harness orders={orders} />);
    });
  }

  function pressKey(key: string) {
    const shiftKey = key === "Shift+Tab";
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: shiftKey ? "Tab" : key,
          shiftKey,
          bubbles: true,
          cancelable: true,
        })
      );
    });
  }
});

function order(id: string, status: OrderStatus): KdsOrder {
  return {
    id,
    source: "COUNTER",
    publicCode: id,
    version: 0,
    ageSeconds: 0,
    overdue: false,
    nextStatuses: status === "SHIPPED" ? ["DELIVERED", "CANCELLED"] : ["PREPARING", "CANCELLED"],
    status,
    total: "10.00",
    customerName: `Cliente ${id}`,
    customerPhone: "11999999999",
    fulfillmentMethod: "DELIVERY",
    paymentMethod: "CASH",
    paymentInstitution: null,
    platformProvider: null,
    notes: null,
    items: [],
    serviceTabId: null,
  };
}
