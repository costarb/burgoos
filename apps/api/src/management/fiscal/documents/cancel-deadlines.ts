/** NFC-e cancellation window after authorization, in minutes (research R2). */
const CANCEL_DEADLINE_MINUTES: Record<string, number> = { SP: 30 };
const DEFAULT_CANCEL_DEADLINE_MINUTES = 30;
/** Reminder sent this many minutes before the deadline for assisted cancellations. */
export const CANCEL_REMINDER_MINUTES = 10;

export function cancelDeadline(authorizedAt: Date, state: string | null | undefined): Date {
  const minutes = (state && CANCEL_DEADLINE_MINUTES[state.toUpperCase()]) || DEFAULT_CANCEL_DEADLINE_MINUTES;
  return new Date(authorizedAt.getTime() + minutes * 60_000);
}

export const MIN_CANCEL_REASON = 15;

/** SEFAZ requires 15–255 characters; short reasons fall back to the store default. */
export function cancelReason(reason: string | null | undefined, fallback: string): string {
  const trimmed = reason?.trim() ?? "";
  return (trimmed.length >= MIN_CANCEL_REASON ? trimmed : fallback).slice(0, 255);
}
