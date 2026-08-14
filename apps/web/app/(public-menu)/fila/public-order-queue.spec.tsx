import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { useAdaptivePolling } from "../../../lib/adaptive-polling";
import { PublicOrderQueueClient } from "./public-order-queue";

vi.mock("../../../lib/api", () => ({
  getPublicOrderQueue: vi.fn(),
  getPublicOrderQueueByDomain: vi.fn(),
}));
vi.mock("../../../lib/adaptive-polling", () => ({ useAdaptivePolling: vi.fn() }));

describe("PublicOrderQueueClient polling", () => {
  it("uses five-second visible and reduced hidden refresh without a permanent clock", () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => root.render(<PublicOrderQueueClient initialQueue={{
      storeName: "Loja A",
      generatedAt: "2026-08-13T10:00:00.000Z",
      staleAfterSeconds: 15,
      active: [],
      completed: [],
    }} source={{ slug: "loja-a" }} />));

    expect(vi.mocked(useAdaptivePolling).mock.calls.at(-1)![0]).toMatchObject({
      visibleIntervalMs: 5000,
      hiddenIntervalMs: 30000,
      runImmediately: false,
    });
    expect(setIntervalSpy).not.toHaveBeenCalled();
    act(() => root.unmount());
    setIntervalSpy.mockRestore();
  });
});
