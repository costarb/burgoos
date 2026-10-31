import { describe, expect, it } from "vitest";
import {
  isValidCnpj,
  isValidCpf,
  isValidStateRegistration,
  maskDocument,
  normalizeConsumerDocument,
} from "./br-documents";

describe("brazilian documents", () => {
  it("validates numeric CNPJ check digits", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11222333000182")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
    expect(isValidCnpj("1122233300018")).toBe(false);
  });

  it("validates the alphanumeric CNPJ from the Receita Federal example", () => {
    expect(isValidCnpj("12.ABC.345/01DE-35")).toBe(true);
    expect(isValidCnpj("12abc34501de35")).toBe(true);
    expect(isValidCnpj("12ABC34501DE36")).toBe(false);
    expect(isValidCnpj("12ABC34501DEA5")).toBe(false);
  });

  it("validates CPF check digits", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224724")).toBe(false);
    expect(isValidCpf("11111111111")).toBe(false);
  });

  it("normalizes the consumer document only when valid", () => {
    expect(normalizeConsumerDocument("529.982.247-25")).toBe("52998224725");
    expect(normalizeConsumerDocument("11.222.333/0001-81")).toBe("11222333000181");
    expect(normalizeConsumerDocument("123")).toBeNull();
  });

  it("validates SP state registration with both check digits", () => {
    expect(isValidStateRegistration("110.042.490.114", "SP")).toBe(true);
    expect(isValidStateRegistration("110042491114", "SP")).toBe(false);
    expect(isValidStateRegistration("110042490115", "SP")).toBe(false);
    expect(isValidStateRegistration("11004249011", "SP")).toBe(false);
  });

  it("only checks the format for states not piloted yet", () => {
    expect(isValidStateRegistration("0623079040081", "MG")).toBe(true);
    expect(isValidStateRegistration("000", "MG")).toBe(false);
  });

  it("masks documents keeping the last digits", () => {
    expect(maskDocument("52998224725")).toBe("*********25");
    expect(maskDocument("11222333000181")).toBe("**********0181");
    expect(maskDocument(null)).toBeNull();
  });
});
