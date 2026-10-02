import { describe, expect, it } from "vitest";
import {
  addDays,
  currentMonthEnd,
  currentMonthStart,
  dayEnd,
  dayStart,
  endOfDay,
  formatDate,
  parseDate,
} from "./report-period";

describe("report period helpers", () => {
  it("returns the current month boundaries in local time", () => {
    const now = new Date(2026, 1, 14, 10, 30);
    expect(currentMonthStart(now)).toEqual(new Date(2026, 1, 1, 0, 0, 0, 0));
    expect(currentMonthEnd(now)).toEqual(new Date(2026, 1, 28, 23, 59, 59, 999));
  });

  it("parses day boundaries from YYYY-MM-DD", () => {
    expect(dayStart("2026-09-01")).toEqual(new Date(2026, 8, 1, 0, 0, 0, 0));
    expect(dayEnd("2026-09-30")).toEqual(new Date(2026, 8, 30, 23, 59, 59, 999));
    expect(parseDate("2026-09-15T10:00:00Z")).toEqual(new Date(2026, 8, 15));
  });

  it("moves dates to the end of the day", () => {
    expect(endOfDay(new Date(2026, 8, 15, 8))).toEqual(new Date(2026, 8, 15, 23, 59, 59, 999));
    expect(addDays(new Date(2026, 8, 25, 8), 10)).toEqual(new Date(2026, 9, 5, 23, 59, 59, 999));
  });

  it("formats local dates", () => {
    expect(formatDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});
