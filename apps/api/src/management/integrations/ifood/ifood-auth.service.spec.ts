import { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import { IfoodAuthService } from "./ifood-auth.service";

describe("IfoodAuthService", () => {
  it("returns distributed OAuth token metadata in mock mode", async () => {
    const service = new IfoodAuthService({
      get: vi.fn((key: string) => (key === "IFOOD_MOCK_MODE" ? "true" : undefined)),
    } as unknown as ConfigService);

    const token = await service.exchangeAuthorizationCode({
      clientId: "client",
      clientSecret: "secret",
      authorizationCode: "code",
    });

    expect(token.accessToken).toBe("mock-ifood-access-token");
    expect(token.refreshToken).toBe("mock-ifood-refresh-token");
    expect(token.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("uses refresh token grant when refreshToken is present", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        access_token: "access",
        refresh_token: "refresh",
        expires_in: 10,
        refresh_expires_in: 20,
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const service = new IfoodAuthService({
      get: vi.fn((key: string) => {
        if (key === "IFOOD_MOCK_MODE") return "false";
        if (key === "IFOOD_AUTH_BASE_URL") return "https://ifood.test/authentication";
        return undefined;
      }),
    } as unknown as ConfigService);

    await service.exchangeAuthorizationCode({
      clientId: "client",
      clientSecret: "secret",
      refreshToken: "refresh",
    });

    const [, requestInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = requestInit.body as URLSearchParams;
    expect(body.get("grantType")).toBe("refresh_token");
    expect(body.get("refreshToken")).toBe("refresh");

    vi.unstubAllGlobals();
  });
});
