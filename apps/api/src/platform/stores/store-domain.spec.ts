import { describe, expect, it } from "vitest";
import { normalizeRequestHost, normalizeStoreDomain } from "./store-domain";

describe("store domain", () => {
  it.each([
    ["DogaodoMounjaro.com.br", "dogaodomounjaro.com.br"],
    ["www.dogaodomounjaro.com.br", "dogaodomounjaro.com.br"],
    ["dogaodomounjaro.com.br.", "dogaodomounjaro.com.br"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeStoreDomain(input)).toBe(expected);
  });

  it.each([
    "https://dogaodomounjaro.com.br",
    "dogaodomounjaro.com.br/cardapio",
    "dogaodomounjaro.com.br:3000",
    "invalid",
    "-invalid.com",
  ])("rejects invalid administrative value %s", (input) => {
    expect(() => normalizeStoreDomain(input)).toThrow();
  });

  it("accepts a forwarded host with port and only uses its first value", () => {
    expect(normalizeRequestHost("www.dogaodomounjaro.com.br:443, proxy.internal")).toBe(
      "dogaodomounjaro.com.br"
    );
  });
});
