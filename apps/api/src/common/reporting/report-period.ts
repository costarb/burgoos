/**
 * Date helpers shared by the DRE, menu engineering and cash flow endpoints (and the MCP tools
 * that reuse them). They interpret `YYYY-MM-DD` in the server's local time, exactly as those
 * controllers always did; sales and management reports use the business-time-zone helpers in
 * `sales-report.types.ts` instead.
 */

export function currentMonthStart(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

export function currentMonthEnd(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function dayStart(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function dayEnd(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

export function parseDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function endOfDay(value: Date): Date {
  const end = new Date(value);
  end.setHours(23, 59, 59, 999);
  return end;
}

/** Adds calendar days and moves the result to the end of that day. */
export function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  next.setHours(23, 59, 59, 999);
  return next;
}

/** Formats a Date as `YYYY-MM-DD` in the server's local time. */
export function formatDate(value: Date): string {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}
