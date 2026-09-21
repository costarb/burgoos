"use client";

import React from "react";
import type { NavigationProgressStatus } from "./use-navigation-progress";

/**
 * Thin top-of-viewport progress bar shown while `status === "visible"`.
 * Purely presentational - see use-navigation-progress.ts for the timing
 * state machine that decides when it should render.
 */
export function NavigationProgressBar({ status }: { status: NavigationProgressStatus }) {
  if (status !== "visible") {
    return null;
  }

  return (
    <div
      aria-hidden
      className="fixed inset-x-0 top-0 z-50 h-[3px] overflow-hidden bg-tomato/15"
      data-testid="navigation-progress-bar"
    >
      <div className="h-full w-1/3 rounded-full bg-tomato motion-reduce:w-full motion-safe:animate-nav-progress-sweep" />
    </div>
  );
}
