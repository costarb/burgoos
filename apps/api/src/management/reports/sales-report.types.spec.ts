import { describe, expect, it } from "vitest";
import { formatLocalDate, localDayEnd, localDayStart } from "./sales-report.types";

describe("sales report business timezone", () => {
  it("builds Sao Paulo day boundaries independently from the server timezone", () => {
    expect(localDayStart("2026-07-20").toISOString()).toBe("2026-07-20T03:00:00.000Z");
    expect(localDayEnd("2026-07-20").toISOString()).toBe("2026-07-21T02:59:59.999Z");
  });

  it("groups UTC timestamps by their Sao Paulo calendar day", () => {
    expect(formatLocalDate(new Date("2026-07-21T00:00:42.000Z"))).toBe("2026-07-20");
    expect(formatLocalDate(new Date("2026-07-20T23:51:07.000Z"))).toBe("2026-07-20");
    expect(formatLocalDate(new Date("2026-07-21T03:00:11.000Z"))).toBe("2026-07-21");
  });
});
