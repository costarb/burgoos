import { describe, expect, it } from "vitest";
import { redactResourceMessage, redactResourceValue } from "./resource-redaction";

describe("resource redaction", () => {
  it("redacts credentials, tokens, card fields and raw payloads recursively", () => {
    expect(redactResourceValue({
      accessToken: "secret-token",
      credentials: { password: "secret" },
      card: { number: "4111111111111111", cvv: "123" },
      rawProviderPayload: { customer: "private" },
      safe: "job-123",
    })).toEqual({
      accessToken: "[REDACTED]",
      credentials: "[REDACTED]",
      card: "[REDACTED]",
      rawProviderPayload: "[REDACTED]",
      safe: "job-123",
    });
  });

  it("bounds messages and masks bearer/card values", () => {
    const result = redactResourceMessage(`Bearer abc.def 4111 1111 1111 1111 ${"x".repeat(600)}`);
    expect(result).not.toContain("abc.def");
    expect(result).not.toContain("4111 1111");
    expect(result.length).toBeLessThanOrEqual(500);
  });
});
