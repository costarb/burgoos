"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KdsOrder, OrderStatus } from "@rrfive/types";

const CANCEL_CONFIRM_WINDOW_MS = 2000;

export interface UseOrderQueueShortcutsOptions {
  /** Orders already in the queue's canonical order (oldest first, across all columns). */
  orders: KdsOrder[];
  /** Status mapped to keys 1-4, in that order. */
  columns: OrderStatus[];
  /** When true, every shortcut is ignored (a modal or an inline form is open). */
  isInputBlocked: boolean;
  onPrimaryAction: (order: KdsOrder) => void;
  onDestructiveAction: (order: KdsOrder) => void;
  onCharge: (order: KdsOrder) => void;
}

export interface OrderQueuePosition {
  index: number;
  total: number;
}

export interface UseOrderQueueShortcutsResult {
  selectedOrderId: string | null;
  selectedOrder: KdsOrder | null;
  position: OrderQueuePosition | null;
  pendingCancelOrderId: string | null;
  registerCardRef: (orderId: string) => (element: HTMLElement | null) => void;
  /** Directly sets the selected order by id (e.g. to advance to a known-next order after an action). */
  selectOrder: (orderId: string | null) => void;
}

function isEditableElement(element: Element | null): boolean {
  if (!element) return false;
  const tag = element.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return (element as HTMLElement).isContentEditable === true;
}

function isNativelyInteractive(element: Element | null): boolean {
  if (!element) return false;
  if (isEditableElement(element)) return true;
  const tag = element.tagName;
  if (tag === "BUTTON" || tag === "A") return true;
  const tabIndexAttr = element.getAttribute("tabindex");
  return tabIndexAttr !== null && tabIndexAttr !== "-1";
}

export function useOrderQueueShortcuts({
  orders,
  columns,
  isInputBlocked,
  onPrimaryAction,
  onDestructiveAction,
  onCharge,
}: UseOrderQueueShortcutsOptions): UseOrderQueueShortcutsResult {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [pendingCancelOrderId, setPendingCancelOrderId] = useState<string | null>(null);

  const ordersRef = useRef(orders);
  ordersRef.current = orders;
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const selectedIndexRef = useRef(-1);
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());

  const clearPendingCancel = useCallback(() => {
    if (cancelTimerRef.current) {
      clearTimeout(cancelTimerRef.current);
      cancelTimerRef.current = null;
    }
    setPendingCancelOrderId(null);
  }, []);

  const selectOrder = useCallback(
    (orderId: string | null) => {
      setSelectedOrderId(orderId);
      selectedIndexRef.current = orderId
        ? ordersRef.current.findIndex((order) => order.id === orderId)
        : -1;
      clearPendingCancel();
    },
    [clearPendingCancel]
  );

  const registerCardRef = useCallback(
    (orderId: string) => (element: HTMLElement | null) => {
      if (element) {
        cardRefs.current.set(orderId, element);
      } else {
        cardRefs.current.delete(orderId);
      }
    },
    []
  );

  // Reconciliation (FR-012): keep the selection pointing at a valid order when
  // the queue changes (realtime updates). If the selected order disappeared,
  // fall back to the closest still-valid position instead of losing the seat.
  useEffect(() => {
    setSelectedOrderId((current) => {
      if (current === null) {
        return current;
      }

      const foundIndex = orders.findIndex((order) => order.id === current);
      if (foundIndex !== -1) {
        selectedIndexRef.current = foundIndex;
        return current;
      }

      if (orders.length === 0) {
        selectedIndexRef.current = -1;
        return null;
      }

      const clampedIndex = Math.min(Math.max(selectedIndexRef.current, 0), orders.length - 1);
      selectedIndexRef.current = clampedIndex;
      return orders[clampedIndex].id;
    });
  }, [orders]);

  // If the order a pending F3 confirmation was armed for disappears, drop it.
  useEffect(() => {
    if (pendingCancelOrderId && !orders.some((order) => order.id === pendingCancelOrderId)) {
      clearPendingCancel();
    }
  }, [orders, pendingCancelOrderId, clearPendingCancel]);

  // Keep the selected card focused and in view.
  useEffect(() => {
    if (!selectedOrderId) {
      return;
    }
    const element = cardRefs.current.get(selectedOrderId);
    if (!element) {
      return;
    }
    element.focus({ preventScroll: true });
    if (typeof element.scrollIntoView === "function") {
      element.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedOrderId]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isInputBlocked || isEditableElement(document.activeElement)) {
        return;
      }

      if (event.key === "Escape") {
        selectOrder(null);
        return;
      }

      if (event.key === "Tab" || event.key === " ") {
        if (event.key === "Tab" && isNativelyInteractive(document.activeElement)) {
          return;
        }
        event.preventDefault();
        const list = ordersRef.current;
        if (list.length === 0) {
          return;
        }
        const currentIndex = selectedOrderId
          ? list.findIndex((order) => order.id === selectedOrderId)
          : -1;
        const direction = event.shiftKey ? -1 : 1;
        const nextIndex =
          currentIndex === -1 ? 0 : (currentIndex + direction + list.length) % list.length;
        selectOrder(list[nextIndex].id);
        return;
      }

      if (event.key >= "1" && event.key <= "4") {
        const status = columnsRef.current[Number(event.key) - 1];
        const target = ordersRef.current.find((order) => order.status === status);
        if (target) {
          selectOrder(target.id);
        }
        return;
      }

      const currentOrder = selectedOrderId
        ? (ordersRef.current.find((order) => order.id === selectedOrderId) ?? null)
        : null;

      if (!currentOrder) {
        return;
      }

      if (event.key === "F2") {
        event.preventDefault();
        clearPendingCancel();
        onPrimaryAction(currentOrder);
        return;
      }

      if (event.key === "F3") {
        event.preventDefault();
        if (pendingCancelOrderId === currentOrder.id) {
          clearPendingCancel();
          onDestructiveAction(currentOrder);
        } else {
          if (cancelTimerRef.current) {
            clearTimeout(cancelTimerRef.current);
          }
          setPendingCancelOrderId(currentOrder.id);
          cancelTimerRef.current = setTimeout(() => {
            cancelTimerRef.current = null;
            setPendingCancelOrderId(null);
          }, CANCEL_CONFIRM_WINDOW_MS);
        }
        return;
      }

      if (event.key === "F4") {
        event.preventDefault();
        clearPendingCancel();
        if (!currentOrder.serviceTabId) {
          onCharge(currentOrder);
        }
        return;
      }

      if (pendingCancelOrderId) {
        clearPendingCancel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    clearPendingCancel,
    isInputBlocked,
    onCharge,
    onDestructiveAction,
    onPrimaryAction,
    pendingCancelOrderId,
    selectOrder,
    selectedOrderId,
  ]);

  useEffect(() => () => clearPendingCancel(), [clearPendingCancel]);

  const selectedOrder = selectedOrderId
    ? (orders.find((order) => order.id === selectedOrderId) ?? null)
    : null;
  const position: OrderQueuePosition | null = selectedOrder
    ? { index: orders.findIndex((order) => order.id === selectedOrderId) + 1, total: orders.length }
    : null;

  return {
    selectedOrderId,
    selectedOrder,
    position,
    pendingCancelOrderId,
    registerCardRef,
    selectOrder,
  };
}
