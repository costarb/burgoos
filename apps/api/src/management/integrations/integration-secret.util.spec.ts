import { describe, expect, it } from "vitest";
import { redactIntegrationPayload, redactIntegrationSecret } from "./integration-secret.util";

describe("integration secret utilities", () => {
  it("redacts short and long secret values", () => {
    expect(redactIntegrationSecret("abc")).toBe("********");
    expect(redactIntegrationSecret("1234567890abcdef")).toBe("1234...cdef");
    expect(redactIntegrationSecret(null)).toBeNull();
  });

  it("redacts secret-looking keys recursively", () => {
    expect(
      redactIntegrationPayload({
        clientId: "public",
        clientSecret: "super-secret",
        nested: {
          refreshToken: "refresh-token",
          merchantId: "merchant-1",
        },
      })
    ).toEqual({
      clientId: "public",
      clientSecret: "********",
      nested: {
        refreshToken: "********",
        merchantId: "merchant-1",
      },
    });
  });
});
