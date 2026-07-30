"use client";

import { useEffect, useState } from "react";
import type { PaymentCharge } from "@burgoos/types";
import { refreshPaymentCharge } from "../../../lib/api";

const active = new Set(["CREATED", "WAITING_CUSTOMER", "PROCESSING", "UNKNOWN"]);

export function usePaymentCharge(initial: PaymentCharge | null) {
  const [charge, setCharge] = useState(initial);
  useEffect(() => {
    if (!charge || !active.has(charge.status)) return;
    const expiresAt = charge.expiresAt ? Date.parse(charge.expiresAt) : Date.now() + 16 * 60_000;
    const timer = window.setInterval(() => {
      if (Date.now() > expiresAt + 60_000) {
        window.clearInterval(timer);
        return;
      }
      void refreshPaymentCharge(charge.id).then(setCharge).catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [charge?.id, charge?.status, charge?.expiresAt]);
  return { charge, setCharge };
}
