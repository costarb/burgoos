import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { refreshPaymentCharge } from "../../../lib/api";
import { useAdaptivePolling } from "../../../lib/adaptive-polling";
import { usePaymentCharge } from "./use-payment-charge";

vi.mock("../../../lib/api", () => ({ refreshPaymentCharge: vi.fn() }));
vi.mock("../../../lib/adaptive-polling", () => ({ useAdaptivePolling: vi.fn() }));

const pollingMock = vi.mocked(useAdaptivePolling);
const refreshMock = vi.mocked(refreshPaymentCharge);
const charge: Parameters<typeof usePaymentCharge>[0] = {
  id: "charge-1",
  status: "PROCESSING",
  expiresAt: "2099-01-01T00:00:00.000Z",
} as never;

describe("usePaymentCharge", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
  });

  it("tracks only active charges with an abortable, visibility-aware task", async () => {
    refreshMock.mockResolvedValue({ ...(charge as object), status: "PAID" } as never);
    let result!: ReturnType<typeof usePaymentCharge>;
    function Harness() {
      result = usePaymentCharge(charge);
      return null;
    }
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => root.render(React.createElement(Harness)));
    const options = pollingMock.mock.calls.at(-1)![0];
    expect(options).toMatchObject({ enabled: true, visibleIntervalMs: 3000, hiddenIntervalMs: 15000 });

    const controller = new AbortController();
    await act(() => options.task(controller.signal));
    expect(refreshMock).toHaveBeenCalledWith("charge-1", controller.signal);
    expect(result.charge?.status).toBe("PAID");
    expect(pollingMock.mock.calls.at(-1)![0].enabled).toBe(false);
    act(() => root.unmount());
  });
});
