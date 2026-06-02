import { describe, expect, it } from "vitest";
import {
  assertHexColor,
  getContrastRatio,
  getReadableTextColor,
  hasReadableContrast,
  isHexColor,
} from "../src/customer-experience/branding/color-contrast";

describe("store branding color validation", () => {
  it("accepts six-digit hex colors and normalizes casing", () => {
    expect(isHexColor("#c92a2a")).toBe(true);
    expect(assertHexColor("#f59f00", "Cor")).toBe("#F59F00");
  });

  it("rejects invalid color values", () => {
    expect(isHexColor("c92a2a")).toBe(false);
    expect(() => assertHexColor("#fff", "Cor primaria")).toThrow(
      "Cor primaria deve usar formato hexadecimal #RRGGBB"
    );
  });

  it("calculates readable contrast for text choices", () => {
    expect(getContrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21);
    expect(hasReadableContrast("#FFFFFF", "#C92A2A")).toBe(true);
    expect(getReadableTextColor("#F8F9FA")).toBe("#000000");
  });
});
