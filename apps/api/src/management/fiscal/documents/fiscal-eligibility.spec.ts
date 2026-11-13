import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { businessDate, evaluateEligibility } from "./fiscal-eligibility";
import type { FiscalSale } from "./fiscal-sale.loader";

const config = { enabled: true, eligibleSources: ["COUNTER", "IMPORT", "API"] as never };
const now = new Date("2026-10-30T15:00:00.000Z"); // 12:00 in São Paulo
const sale = (overrides: Partial<FiscalSale> = {}): FiscalSale => ({
  target: { type: "ORDER", id: "o1" },
  tenantId: "t1",
  publicCode: "A1",
  source: "COUNTER",
  orderIds: ["o1"],
  cancelled: false,
  partOfTab: null,
  marketplace: false,
  total: new Prisma.Decimal(10),
  paidAmount: new Prisma.Decimal(10),
  paid: true,
  saleOccurredAt: new Date("2026-10-30T13:00:00.000Z"),
  items: [],
  payments: [],
  fallbackPaymentMethod: "CASH",
  consumerDocument: null,
  ...overrides,
});

describe("evaluateEligibility", () => {
  it("uses the São Paulo business day", () => {
    expect(businessDate(new Date("2026-10-31T02:30:00.000Z"))).toBe("2026-10-30");
    expect(businessDate(new Date("2026-10-31T03:00:00.000Z"))).toBe("2026-10-31");
  });

  it("accepts a paid sale of the day for automatic emission", () => {
    expect(evaluateEligibility(config, sale(), { trigger: "AUTOMATIC", now })).toEqual({ eligible: true, retroactive: false });
  });

  it("never emits automatically a sale of a previous day (sold 23:59, imported 00:01)", () => {
    const soldLastNight = sale({ source: "IMPORT", saleOccurredAt: new Date("2026-10-31T02:59:00.000Z") });
    const justAfterMidnight = new Date("2026-10-31T03:01:00.000Z");
    expect(evaluateEligibility(config, soldLastNight, { trigger: "AUTOMATIC", now: justAfterMidnight })).toMatchObject({ eligible: false, reason: "NOT_SAME_DAY" });
    expect(evaluateEligibility(config, soldLastNight, { trigger: "MANUAL", now: justAfterMidnight })).toMatchObject({ reason: "RETROACTIVE_CONFIRMATION_REQUIRED" });
    expect(evaluateEligibility(config, soldLastNight, { trigger: "MANUAL", confirmRetroactive: true, now: justAfterMidnight })).toEqual({ eligible: true, retroactive: true });
  });

  it.each([
    [{ enabled: false, eligibleSources: config.eligibleSources }, sale(), "DISABLED"],
    [config, sale({ source: "PUBLIC_MENU" }), "SOURCE_NOT_ELIGIBLE"],
    [config, sale({ source: "IFOOD" }), "SOURCE_NOT_ELIGIBLE"],
    [config, sale({ source: "IMPORT", marketplace: true }), "SOURCE_NOT_ELIGIBLE"],
    [config, sale({ partOfTab: "tab-1" }), "PART_OF_TAB"],
    [config, sale({ cancelled: true }), "CANCELLED"],
    [config, sale({ total: new Prisma.Decimal(0) }), "ZERO_TOTAL"],
    [config, sale({ paid: false }), "NOT_PAID"],
  ])("rejects ineligible sales (%#)", (configuration, candidate, reason) => {
    expect(evaluateEligibility(configuration as never, candidate, { trigger: "MANUAL", now })).toMatchObject({ eligible: false, reason });
  });
});
