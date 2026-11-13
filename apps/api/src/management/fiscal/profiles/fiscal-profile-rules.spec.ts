import { describe, expect, it } from "vitest";
import { validateFiscalProfile } from "./fiscal-profile-rules";

const base = { name: "Bebidas ST", ncm: "22021000", cfop: "5405", csosn: "500", origin: 0, commercialUnit: "un", cest: "03.007.00" };

describe("validateFiscalProfile", () => {
  it("normalizes punctuation and casing", () => {
    expect(validateFiscalProfile({ ...base, benefitCode: "sp000202" })).toEqual({
      ok: true,
      value: { name: "Bebidas ST", ncm: "22021000", cfop: "5405", csosn: "500", origin: 0, commercialUnit: "UN", cest: "0300700", benefitCode: "SP000202" },
    });
  });

  it("collects every validation error", () => {
    const result = validateFiscalProfile({ name: "x", ncm: "123", cfop: "6102", csosn: "201", origin: 9, commercialUnit: "unidade", cest: "12" });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toHaveLength(7);
  });

  it("requires CEST only for tax substitution", () => {
    expect(validateFiscalProfile({ ...base, cest: null }).ok).toBe(false);
    expect(validateFiscalProfile({ ...base, csosn: "102", cfop: "5102", cest: null }).ok).toBe(true);
  });
});
