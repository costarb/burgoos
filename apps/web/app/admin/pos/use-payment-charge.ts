"use client";

import { useEffect, useState } from "react";
import type { PaymentCharge } from "@burgoos/types";
import { refreshPaymentCharge } from "../../../lib/api";
import { useAdaptivePolling } from "../../../lib/adaptive-polling";

const active = new Set(["CREATED", "WAITING_CUSTOMER", "PROCESSING", "UNKNOWN"]);

export function usePaymentCharge(initial: PaymentCharge | null) {
  const [charge, setCharge] = useState(initial);
  const [expired, setExpired] = useState(false);
  const expiresAt = charge?.expiresAt ? Date.parse(charge.expiresAt) : Number.POSITIVE_INFINITY;

  useEffect(() => {
    setExpired(false);
    if (!Number.isFinite(expiresAt)) return;
    let timer: number | undefined;
    const scheduleExpiration = () => {
      const remaining = expiresAt + 60_000 - Date.now();
      if (remaining <= 0) {
        setExpired(true);
        return;
      }
      timer = window.setTimeout(scheduleExpiration, Math.min(remaining, 2_147_483_647));
    };
    scheduleExpiration();
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [charge?.id, expiresAt]);

  const enabled = Boolean(
    charge && active.has(charge.status) && !expired,
  );
  useAdaptivePolling({
    enabled,
    visibleIntervalMs: 3_000,
    hiddenIntervalMs: 15_000,
    runImmediately: false,
    task: async (signal) => {
      if (!charge) return;
      setCharge(await refreshPaymentCharge(charge.id, signal));
    },
  });
  return { charge, setCharge };
}
