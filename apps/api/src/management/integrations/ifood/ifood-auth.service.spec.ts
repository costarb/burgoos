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
    const [url] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = requestInit.body as URLSearchParams;
    expect(url).toBe("https://ifood.test/authentication/oauth/token");
    expect(body.get("grantType")).toBe("refresh_token");
    expect(body.get("refreshToken")).toBe("refresh");

    vi.unstubAllGlobals();
  });

  it("uses authorization code grant when authorizationCode is present", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        access_token: "access",
        expires_in: 10,
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
      authorizationCode: "code",
    });

    const [, requestInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = requestInit.body as URLSearchParams;
    expect(body.get("grantType")).toBe("authorization_code");
    expect(body.get("authorizationCode")).toBe("code");

    vi.unstubAllGlobals();
  });

  it("uses client credentials grant when no code or refresh token is present", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        access_token: "access",
        expires_in: 10,
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
    });

    const [, requestInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = requestInit.body as URLSearchParams;
    expect(body.get("grantType")).toBe("client_credentials");
    expect(body.has("authorizationCode")).toBe(false);

    vi.unstubAllGlobals();
  });

  it("accepts a full oauth token URL as auth base URL", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        access_token: "access",
        expires_in: 10,
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const service = new IfoodAuthService({
      get: vi.fn((key: string) => {
        if (key === "IFOOD_MOCK_MODE") return "false";
        if (key === "IFOOD_AUTH_BASE_URL") {
          return "https://ifood.test/authentication/v1.0/oauth/token";
        }
        return undefined;
      }),
    } as unknown as ConfigService);

    await service.exchangeAuthorizationCode({
      clientId: "client",
      clientSecret: "secret",
    });

    const [url] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://ifood.test/authentication/v1.0/oauth/token");

    vi.unstubAllGlobals();
  });

  it("surfaces oauth rejection as a gateway error with sanitized response", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => '{"error":"invalid_client","access_token":"secret"}',
    }));
    vi.stubGlobal("fetch", fetchMock);

    const service = new IfoodAuthService({
      get: vi.fn((key: string) => {
        if (key === "IFOOD_MOCK_MODE") return "false";
        if (key === "IFOOD_AUTH_BASE_URL") return "https://ifood.test/authentication/v1.0";
        return undefined;
      }),
    } as unknown as ConfigService);

    await expect(
      service.exchangeAuthorizationCode({
        clientId: "client",
        clientSecret: "secret",
      })
    ).rejects.toThrow("iFood OAuth recusou as credenciais com status 401");

    vi.unstubAllGlobals();
  });
});
