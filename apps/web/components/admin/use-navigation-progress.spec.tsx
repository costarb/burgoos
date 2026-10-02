import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NAVIGATION_PROGRESS_MIN_VISIBLE_MS,
  NAVIGATION_PROGRESS_SAFETY_TIMEOUT_MS,
  NAVIGATION_PROGRESS_SHOW_DELAY_MS,
  shouldTriggerNavigationStart,
  useNavigationProgress,
} from "./use-navigation-progress";
import type { UseNavigationProgressResult } from "./use-navigation-progress";

const usePathnameMock = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

describe("useNavigationProgress", () => {
  let container: HTMLDivElement;
  let root: Root;
  let latestResult: UseNavigationProgressResult;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    usePathnameMock.mockReset();
    usePathnameMock.mockReturnValue("/admin/orders");
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  function Harness() {
    latestResult = useNavigationProgress();
    return null;
  }

  function render() {
    act(() => {
      root.render(<Harness />);
    });
  }

  function changePathname(next: string) {
    usePathnameMock.mockReturnValue(next);
    act(() => {
      root.render(<Harness />);
    });
  }

  it("does not become visible before the show delay", () => {
    render();
    act(() => {
      latestResult.startNavigation();
    });
    expect(latestResult.status).toBe("pending");

    act(() => {
      vi.advanceTimersByTime(NAVIGATION_PROGRESS_SHOW_DELAY_MS - 1);
    });
    expect(latestResult.status).toBe("pending");
  });

  it("never becomes visible if the route changes before the show delay elapses", () => {
    render();
    act(() => {
      latestResult.startNavigation();
    });
    act(() => {
      vi.advanceTimersByTime(NAVIGATION_PROGRESS_SHOW_DELAY_MS - 1);
    });

    changePathname("/admin/finance");
    expect(latestResult.status).toBe("idle");

    act(() => {
      vi.advanceTimersByTime(NAVIGATION_PROGRESS_SHOW_DELAY_MS + 10);
    });
    expect(latestResult.status).toBe("idle");
  });

  it("becomes visible once the show delay elapses without the route changing", () => {
    render();
    act(() => {
      latestResult.startNavigation();
    });
    act(() => {
      vi.advanceTimersByTime(NAVIGATION_PROGRESS_SHOW_DELAY_MS);
    });
    expect(latestResult.status).toBe("visible");
  });

  it("stays visible for at least the minimum time even if the route changes right away", () => {
    render();
    act(() => {
      latestResult.startNavigation();
    });
    act(() => {
      vi.advanceTimersByTime(NAVIGATION_PROGRESS_SHOW_DELAY_MS);
    });
    expect(latestResult.status).toBe("visible");

    changePathname("/admin/finance");
    expect(latestResult.status).toBe("visible");

    act(() => {
      vi.advanceTimersByTime(NAVIGATION_PROGRESS_MIN_VISIBLE_MS - 1);
    });
    expect(latestResult.status).toBe("visible");

    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(latestResult.status).toBe("idle");
  });

  it("returns to idle immediately when the route changes after the minimum visible time", () => {
    render();
    act(() => {
      latestResult.startNavigation();
    });
    act(() => {
      vi.advanceTimersByTime(NAVIGATION_PROGRESS_SHOW_DELAY_MS + NAVIGATION_PROGRESS_MIN_VISIBLE_MS + 500);
    });
    expect(latestResult.status).toBe("visible");

    changePathname("/admin/finance");
    expect(latestResult.status).toBe("idle");
  });

  it("does not regress from visible to pending when another navigation starts mid-flight", () => {
    render();
    act(() => {
      latestResult.startNavigation();
    });
    act(() => {
      vi.advanceTimersByTime(NAVIGATION_PROGRESS_SHOW_DELAY_MS);
    });
    expect(latestResult.status).toBe("visible");

    act(() => {
      latestResult.startNavigation();
    });
    expect(latestResult.status).toBe("visible");
  });

  it("forces idle after the safety timeout even if the route never changes", () => {
    render();
    act(() => {
      latestResult.startNavigation();
    });
    act(() => {
      vi.advanceTimersByTime(NAVIGATION_PROGRESS_SAFETY_TIMEOUT_MS);
    });
    expect(latestResult.status).toBe("idle");
  });
});

describe("shouldTriggerNavigationStart", () => {
  const baseEvent = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };

  it("triggers on a plain left click to a different route", () => {
    expect(shouldTriggerNavigationStart(baseEvent, "/admin/finance", "/admin/orders")).toBe(true);
  });

  it("does not trigger when clicking the link for the route already active", () => {
    expect(shouldTriggerNavigationStart(baseEvent, "/admin/orders", "/admin/orders")).toBe(false);
  });

  it("does not trigger on modified clicks (new tab / new window)", () => {
    expect(
      shouldTriggerNavigationStart({ ...baseEvent, metaKey: true }, "/admin/finance", "/admin/orders")
    ).toBe(false);
    expect(
      shouldTriggerNavigationStart({ ...baseEvent, button: 1 }, "/admin/finance", "/admin/orders")
    ).toBe(false);
  });
});
