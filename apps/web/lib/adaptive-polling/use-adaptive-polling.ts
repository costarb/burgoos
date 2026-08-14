"use client";

import { useEffect, useRef } from "react";
import { AdaptivePoller } from "./adaptive-poller";

export interface UseAdaptivePollingOptions {
  enabled?: boolean;
  task: (signal: AbortSignal) => Promise<void>;
  visibleIntervalMs: number;
  hiddenIntervalMs: number;
  backoffBaseMs?: number;
  backoffMaxMs?: number;
  jitterRatio?: number;
  runImmediately?: boolean;
}

export function useAdaptivePolling(options: UseAdaptivePollingOptions): void {
  const taskRef = useRef(options.task);
  taskRef.current = options.task;

  useEffect(() => {
    if (options.enabled === false) return;
    const poller = new AdaptivePoller({
      task: (signal) => taskRef.current(signal),
      visibleIntervalMs: options.visibleIntervalMs,
      hiddenIntervalMs: options.hiddenIntervalMs,
      backoffBaseMs: options.backoffBaseMs,
      backoffMaxMs: options.backoffMaxMs,
      jitterRatio: options.jitterRatio,
      runImmediately: options.runImmediately,
    });
    poller.start();
    return () => poller.stop();
  }, [
    options.enabled,
    options.visibleIntervalMs,
    options.hiddenIntervalMs,
    options.backoffBaseMs,
    options.backoffMaxMs,
    options.jitterRatio,
    options.runImmediately,
  ]);
}
