import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getKdsOrders } from "../../../lib/api";
import { useAdaptivePolling } from "../../../lib/adaptive-polling";
import { useKdsOrders } from "./use-kds-orders";

const socket = { on: vi.fn(), disconnect: vi.fn() };
vi.mock("socket.io-client", () => ({ io: vi.fn(() => socket) }));
vi.mock("../../../lib/api", () => ({ getKdsOrders: vi.fn() }));
vi.mock("../../../lib/adaptive-polling", () => ({ useAdaptivePolling: vi.fn() }));

describe("useKdsOrders", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    socket.on.mockReturnValue(socket);
  });

  it("uses Socket.io as primary path and deduplicates recovery refreshes", async () => {
    let resolve!: (orders: never[]) => void;
    vi.mocked(getKdsOrders).mockReturnValue(new Promise((done) => { resolve = done; }));
    let result!: ReturnType<typeof useKdsOrders>;
    function Harness() {
      result = useKdsOrders({ apiUrl: "http://api", tenantId: "tenant-1", token: "token", initialOrders: [] });
      return null;
    }
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => root.render(<Harness />));

    expect(socket.on).toHaveBeenCalledWith("order-created", expect.any(Function));
    expect(vi.mocked(useAdaptivePolling).mock.calls.at(-1)![0]).toMatchObject({
      visibleIntervalMs: 15000,
      hiddenIntervalMs: 120000,
      runImmediately: false,
    });
    const first = result.refresh();
    const second = result.refresh();
    expect(getKdsOrders).toHaveBeenCalledOnce();
    resolve([]);
    await act(() => Promise.all([first, second]));
    act(() => root.unmount());
  });
});
