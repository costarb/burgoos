import { describe, expect, it } from "vitest";
import { competenceFromDate, currentCompetence, parseCompetence } from "./dre-competence";

describe("DRE competence", () => {
  it("computes the business-month windows", () => {
    const parsed = parseCompetence("2026-02");
    expect(parsed).toMatchObject({ competence: "2026-02", firstDay: "2026-02-01", lastDay: "2026-02-28" });
    expect(parsed.salesStart.toISOString()).toBe("2026-02-01T03:00:00.000Z");
    expect(parsed.salesEnd.toISOString()).toBe("2026-03-01T02:59:59.999Z");
    expect(parsed.expenseStart).toEqual(new Date(2026, 1, 1));
    expect(parsed.expenseEnd).toEqual(new Date(2026, 2, 1));
  });

  it("defaults to the current business month (Sao Paulo)", () => {
    expect(currentCompetence(new Date("2026-10-01T02:00:00.000Z"))).toBe("2026-09");
    expect(parseCompetence(undefined, new Date("2026-10-15T12:00:00.000Z")).competence).toBe("2026-10");
  });

  it.each(["2026-13", "2026-1", "09/2026", ""])("rejects %s", (value) => {
    expect(() => parseCompetence(value)).toThrow("Competencia invalida");
  });

  it("maps legacy start dates to their month", () => {
    expect(competenceFromDate("2026-09-15")).toBe("2026-09");
    expect(competenceFromDate(undefined)).toBeUndefined();
  });
});
