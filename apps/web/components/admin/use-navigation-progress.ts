"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { usePathname } from "next/navigation";

export type NavigationProgressStatus = "idle" | "pending" | "visible";

export const NAVIGATION_PROGRESS_SHOW_DELAY_MS = 150;
export const NAVIGATION_PROGRESS_MIN_VISIBLE_MS = 200;
export const NAVIGATION_PROGRESS_SAFETY_TIMEOUT_MS = 15000;

export interface UseNavigationProgressResult {
  status: NavigationProgressStatus;
  /** Call from a nav link's onClick to signal that a navigation has started. */
  startNavigation: () => void;
}

/**
 * Whether a click on an internal navigation link should arm the progress
 * indicator: only plain left-clicks (no modifier keys, so the browser
 * default of opening a new tab is left untouched) that actually change the
 * current route.
 */
export function shouldTriggerNavigationStart(
  event: Pick<MouseEvent, "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">,
  targetHref: string,
  currentPathname: string | null
): boolean {
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  return targetHref !== currentPathname;
}

/**
 * Drives the idle -> pending -> visible -> idle state machine for the
 * global navigation progress bar (see specs/024-navigation-loading-indicator).
 *
 * - idle -> pending: `startNavigation()` is called.
 * - pending -> visible: NAVIGATION_PROGRESS_SHOW_DELAY_MS elapses without
 *   the route having changed yet (avoids a flash on fast navigations).
 * - visible -> idle: the route changed AND at least
 *   NAVIGATION_PROGRESS_MIN_VISIBLE_MS has elapsed since becoming visible
 *   (avoids the bar flickering off instantly).
 * - anything -> idle: NAVIGATION_PROGRESS_SAFETY_TIMEOUT_MS elapses without
 *   the route ever changing (never gets stuck).
 */
export function useNavigationProgress(): UseNavigationProgressResult {
  const [status, setStatus] = useState<NavigationProgressStatus>("idle");
  const statusRef = useRef<NavigationProgressStatus>("idle");
  const pathname = usePathname();
  const isFirstRenderRef = useRef(true);

  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleAtRef = useRef<number | null>(null);

  const applyStatus = useCallback((next: NavigationProgressStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const clearAllTimers = useCallback(() => {
    if (showTimer.current) clearTimeout(showTimer.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    showTimer.current = null;
    hideTimer.current = null;
    safetyTimer.current = null;
  }, []);

  const finish = useCallback(() => {
    clearAllTimers();
    visibleAtRef.current = null;
    applyStatus("idle");
  }, [applyStatus, clearAllTimers]);

  const startNavigation = useCallback(() => {
    if (statusRef.current === "idle") {
      applyStatus("pending");
      showTimer.current = setTimeout(() => {
        showTimer.current = null;
        visibleAtRef.current = Date.now();
        applyStatus("visible");
      }, NAVIGATION_PROGRESS_SHOW_DELAY_MS);
    }
    // Whether this is the first click of a navigation or another one firing
    // while we're already pending/visible, extend the safety net.
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    safetyTimer.current = setTimeout(finish, NAVIGATION_PROGRESS_SAFETY_TIMEOUT_MS);
  }, [applyStatus, finish]);

  // Completion signal: the route actually changed.
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }

    if (statusRef.current === "pending") {
      if (showTimer.current) {
        clearTimeout(showTimer.current);
        showTimer.current = null;
      }
      finish();
      return;
    }

    if (statusRef.current === "visible") {
      const elapsed = visibleAtRef.current
        ? Date.now() - visibleAtRef.current
        : NAVIGATION_PROGRESS_MIN_VISIBLE_MS;
      const remaining = Math.max(0, NAVIGATION_PROGRESS_MIN_VISIBLE_MS - elapsed);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (remaining === 0) {
        finish();
      } else {
        hideTimer.current = setTimeout(finish, remaining);
      }
    }
    // Only the pathname changing should drive completion.
  }, [pathname, finish]);

  useEffect(() => clearAllTimers, [clearAllTimers]);

  return { status, startNavigation };
}
