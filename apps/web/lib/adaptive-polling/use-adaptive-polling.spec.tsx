import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdaptivePoller } from "./adaptive-poller";
import { useAdaptivePolling } from "./use-adaptive-polling";

describe("AdaptivePoller", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("never overlaps a slow request", async () => {
    const first = deferred<void>();
    const task = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    const poller = new AdaptivePoller({ task, visibleIntervalMs: 100, hiddenIntervalMs: 1_000 });
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(task).toHaveBeenCalledTimes(1);

    first.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(99);
    expect(task).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(task).toHaveBeenCalledTimes(2);
    poller.stop();
  });

  it("uses the hidden interval and refreshes immediately when visible again", async () => {
    let visibility: DocumentVisibilityState = "hidden";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    const task = vi.fn().mockResolvedValue(undefined);
    const poller = new AdaptivePoller({ task, visibleIntervalMs: 100, hiddenIntervalMs: 1_000 });
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(999);
    expect(task).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(task).toHaveBeenCalledTimes(2);

    visibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(task).toHaveBeenCalledTimes(3);
    poller.stop();
  });

  it("applies exponential backoff with bounded jitter after failures", async () => {
    const task = vi.fn().mockRejectedValue(new Error("offline"));
    const poller = new AdaptivePoller({
      task,
      visibleIntervalMs: 100,
      hiddenIntervalMs: 1_000,
      backoffBaseMs: 100,
      backoffMaxMs: 1_000,
      jitterRatio: 0.2,
      random: () => 1,
    });
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(119);
    expect(task).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(task).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(239);
    expect(task).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(task).toHaveBeenCalledTimes(3);
    poller.stop();
  });

  it("can disable the immediate first request", async () => {
    const task = vi.fn().mockResolvedValue(undefined);
    const poller = new AdaptivePoller({
      task,
      visibleIntervalMs: 100,
      hiddenIntervalMs: 1_000,
      runImmediately: false,
    });
    poller.start();
    await vi.advanceTimersByTimeAsync(99);
    expect(task).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(task).toHaveBeenCalledTimes(1);
    poller.stop();
  });
});

describe("useAdaptivePolling", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("aborts the active request and removes timers on unmount", async () => {
    let signal: AbortSignal | undefined;
    const task = vi.fn((nextSignal: AbortSignal) => {
      signal = nextSignal;
      return new Promise<void>(() => undefined);
    });

    await act(async () => {
      root.render(<PollingHarness task={task} />);
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(signal?.aborted).toBe(false);
    act(() => root.unmount());
    expect(signal?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(task).toHaveBeenCalledTimes(1);
    root = createRoot(container);
  });
});

function PollingHarness({ task }: { task: (signal: AbortSignal) => Promise<void> }) {
  useAdaptivePolling({ task, visibleIntervalMs: 100, hiddenIntervalMs: 1_000 });
  return null;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
  return { promise, resolve };
}
