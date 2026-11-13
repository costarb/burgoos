import type { FiscalProfile } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { ComposerInput, ComposerOrderItem, composeNfce } from "./nfce-composer";

const profile = (id: string, overrides: Partial<FiscalProfile> = {}): FiscalProfile => ({
  id,
  tenantId: "t1",
  name: id,
  ncm: "21069090",
  cfop: "5102",
  csosn: "102",
  origin: 0,
  commercialUnit: "UN",
  cest: null,
  benefitCode: null,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});
const FOOD = profile("food");
const DRINK = profile("drink", { ncm: "22021000", cfop: "5405", csosn: "500", cest: "0300700" });

const hotDog = (overrides: Partial<ComposerOrderItem> = {}): ComposerOrderItem => ({
  productId: "hot-dog",
  productNameSnapshot: "Hot Dog",
  quantity: 2,
  unitPrice: "28.00",
  total: "56.00",
  baseUnitPrice: "25.00",
  calculatedUnitPrice: "28.00",
  chargedUnitPrice: "28.00",
  modifications: [
    { type: "ADD_COMPLEMENT", complementId: "bacon", nameSnapshot: "Bacon extra", quantity: "1", unitPriceDelta: "3.00", totalPriceDelta: "3.00" },
    { type: "REMOVE_INGREDIENT", complementId: null, nameSnapshot: "Cebola", quantity: "1", unitPriceDelta: "0", totalPriceDelta: "0" },
    { type: "ADD_COMPLEMENT", complementId: "ketchup", nameSnapshot: "Ketchup", quantity: "1", unitPriceDelta: "0", totalPriceDelta: "0" },
  ],
  ...overrides,
});

const input = (overrides: Partial<ComposerInput> = {}): ComposerInput => ({
  items: [hotDog()],
  total: "56.00",
  payments: [{ method: "PIX", amount: "56.00" }],
  fallbackPaymentMethod: "CASH",
  productProfiles: new Map([["hot-dog", FOOD], ["soda", DRINK]]),
  complementProfiles: new Map([["bacon", null]]),
  ...overrides,
});

describe("composeNfce", () => {
  it("emits the product at its base price and each paid complement as its own line", () => {
    const result = composeNfce(input());
    if (!result.ok) throw new Error(result.message);

    expect(result.items).toEqual([
      expect.objectContaining({ code: "hot-dog", description: "Hot Dog", quantity: "2.0000", unitPrice: "25", grossAmount: "50.00", discount: "0.00", ncm: "21069090" }),
      expect.objectContaining({ code: "bacon", description: "Bacon extra", quantity: "2.0000", unitPrice: "3", grossAmount: "6.00", csosn: "102" }),
    ]);
    expect(result.total).toBe("56.00");
    expect(result.payments).toEqual([{ method: "PIX", tPag: "17", amount: "56.00" }]);
  });

  it("uses the complement profile when it has one", () => {
    const result = composeNfce(input({ complementProfiles: new Map([["bacon", DRINK]]) }));
    expect(result.ok && result.items[1]).toMatchObject({ csosn: "500", cest: "0300700" });
  });

  it("spreads a manual price reduction as discount over the item lines", () => {
    const result = composeNfce(
      input({ items: [hotDog({ chargedUnitPrice: "25.00", unitPrice: "25.00", total: "50.00" })], total: "50.00", payments: [{ method: "PIX", amount: "50.00" }] })
    );
    if (!result.ok) throw new Error(result.message);
    expect(result.items.map((item) => item.discount)).toEqual(["5.36", "0.64"]);
    const net = result.items.reduce((sum, item) => sum + Number(item.grossAmount) - Number(item.discount) + Number(item.otherExpenses), 0);
    expect(net.toFixed(2)).toBe("50.00");
  });

  it("records a manual price increase as other expenses on the main line", () => {
    const result = composeNfce(input({ items: [hotDog({ chargedUnitPrice: "30.00", unitPrice: "30.00", total: "60.00" })], total: "60.00", payments: [] }));
    expect(result.ok && result.items[0].otherExpenses).toBe("4.00");
  });

  it("derives the base price for legacy items without pricing breakdown", () => {
    const result = composeNfce(
      input({
        items: [{ productId: "soda", productNameSnapshot: "Refrigerante", quantity: 3, unitPrice: "6.00", total: "18.00", baseUnitPrice: null, calculatedUnitPrice: null, chargedUnitPrice: null, modifications: [] }],
        total: "18.00",
        payments: [],
      })
    );
    expect(result.ok && result.items).toEqual([expect.objectContaining({ grossAmount: "18.00", csosn: "500" })]);
    expect(result.ok && result.payments).toEqual([{ method: "CASH", tPag: "01", amount: "18.00" }]);
  });

  it("adjusts rounding differences against the charged total", () => {
    const result = composeNfce(input({ total: "55.99" }));
    expect(result.ok && result.adjustment).toBe("-0.01");
    expect(result.ok && result.items.reduce((sum, item) => sum + Number(item.discount), 0).toFixed(2)).toBe("0.01");
  });

  it("splits payments, fills the uncovered rest and computes cash change", () => {
    const result = composeNfce(input({ payments: [{ method: "PIX", amount: "30.00" }, { method: "CASH", amount: "30.00" }] }));
    expect(result.ok && result.payments).toEqual([
      { method: "PIX", tPag: "17", amount: "30.00" },
      { method: "CASH", tPag: "01", amount: "30.00" },
    ]);
    expect(result.ok && result.change).toBe("4.00");

    const partial = composeNfce(input({ payments: [{ method: "DEBIT_CARD", amount: "20.00" }], fallbackPaymentMethod: "PIX_MANUAL" }));
    expect(partial.ok && partial.payments).toEqual([
      { method: "DEBIT_CARD", tPag: "04", amount: "20.00" },
      { method: "PIX_MANUAL", tPag: "20", amount: "36.00" },
    ]);
  });

  it("trims non-cash overpayment instead of reporting change", () => {
    const result = composeNfce(input({ payments: [{ method: "CREDIT_CARD", amount: "60.00" }] }));
    expect(result.ok && result.payments).toEqual([{ method: "CREDIT_CARD", tPag: "03", amount: "56.00" }]);
    expect(result.ok && result.change).toBe("0.00");
  });

  it("refuses to compose when a product has no fiscal profile", () => {
    const result = composeNfce(input({ productProfiles: new Map() }));
    expect(result).toMatchObject({ ok: false, code: "MISSING_FISCAL_DATA", missing: ["Hot Dog", "Bacon extra"] });
  });
});
