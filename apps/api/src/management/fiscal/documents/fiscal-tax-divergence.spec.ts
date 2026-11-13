import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { NfceDraftItem } from "../providers/fiscal-provider.adapter";
import { authorizedItemTaxes, compareItemTaxes } from "./fiscal-tax-divergence";

const item = (code: string, overrides: Partial<NfceDraftItem> = {}): NfceDraftItem => ({
  code,
  description: code,
  quantity: "1.0000",
  unitPrice: "1.00",
  grossAmount: "1.00",
  discount: "0.00",
  freight: "0.00",
  otherExpenses: "0.00",
  ncm: "21069090",
  cfop: "5102",
  csosn: "102",
  origin: 0,
  unit: "UN",
  cest: null,
  benefitCode: null,
  ...overrides,
});

describe("fiscal tax divergence", () => {
  it("reads CFOP and CSOSN of each item from a Bling authorized XML", () => {
    const xml = readFileSync(join(__dirname, "../providers/bling/__fixtures__/nfce-authorized.xml"), "utf8");
    expect(authorizedItemTaxes(xml)).toEqual([{ code: "TESTE-RRF5-1", cfop: "5102", csosn: "102" }]);
  });

  it("flags items authorized with taxes other than the fiscal profile", () => {
    const soda = item("SODA", { description: "Coca-Cola", ncm: "22021000", cfop: "5405", csosn: "500" });
    const authorized = [
      { code: "HOTDOG", cfop: "5102", csosn: "102" },
      { code: "SODA", cfop: "5102", csosn: "102" },
    ];

    expect(compareItemTaxes([item("HOTDOG"), soda], authorized)).toEqual([
      { code: "SODA", description: "Coca-Cola", ncm: "22021000", expected: { cfop: "5405", csosn: "500" }, actual: { cfop: "5102", csosn: "102" } },
    ]);
  });

  it("does not compare when the item count differs or the XML has no items", () => {
    expect(compareItemTaxes([item("A"), item("B")], [{ code: "A", cfop: "5405", csosn: "500" }])).toEqual([]);
    expect(compareItemTaxes([item("A")], authorizedItemTaxes("<nfeProc/>"))).toEqual([]);
  });
});
