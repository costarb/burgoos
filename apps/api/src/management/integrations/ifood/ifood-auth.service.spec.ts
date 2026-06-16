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

  it("requires authorization code verifier when authorizationCode is present", async () => {
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

    await expect(
      service.exchangeAuthorizationCode({
        clientId: "client",
        clientSecret: "secret",
        authorizationCode: "code",
      })
    ).rejects.toThrow("authorizationCodeVerifier");

    vi.unstubAllGlobals();
  });

  it("sends authorization code verifier with authorization code grant when present", async () => {
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
        if (key === "IFOOD_AUTH_BASE_URL") return "https://ifood.test/authentication/v1.0";
        return undefined;
      }),
    } as unknown as ConfigService);

    await service.exchangeAuthorizationCode({
      clientId: "client",
      clientSecret: "secret",
      authorizationCode: "code",
      authorizationCodeVerifier: "verifier",
    });

    const [, requestInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = requestInit.body as URLSearchParams;
    expect(body.get("grantType")).toBe("authorization_code");
    expect(body.get("authorizationCodeVerifier")).toBe("verifier");

    vi.unstubAllGlobals();
  });

  it("requires user authorization before saving credentials without refresh token", async () => {
    const service = new IfoodAuthService({
      get: vi.fn((key: string) => {
        if (key === "IFOOD_MOCK_MODE") return "false";
        if (key === "IFOOD_AUTH_BASE_URL") return "https://ifood.test/authentication";
        return undefined;
      }),
    } as unknown as ConfigService);

    await expect(
      service.exchangeAuthorizationCode({
        clientId: "client",
        clientSecret: "secret",
      })
    ).rejects.toThrow("Gere o codigo iFood");
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
      refreshToken: "refresh",
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
        refreshToken: "refresh",
      })
    ).rejects.toThrow("iFood OAuth recusou as credenciais com status 401");

    vi.unstubAllGlobals();
  });

  it("requests user code with verification URL data", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        userCode: "NWHF-WMTW",
        authorizationCodeVerifier: "verifier",
        verificationUrl: "https://portal.ifood.com.br/apps/code",
        verificationUrlComplete: "https://portal.ifood.com.br/apps/code?c=NWHF-WMTW",
        expiresIn: 600,
      }),
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
      service.requestUserCode({
        clientId: "client",
        clientSecret: "secret",
      })
    ).resolves.toEqual(
      expect.objectContaining({
        userCode: "NWHF-WMTW",
        authorizationCodeVerifier: "verifier",
        verificationUrlComplete: "https://portal.ifood.com.br/apps/code?c=NWHF-WMTW",
        expiresIn: 600,
      })
    );

    const [url, requestInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = requestInit.body as URLSearchParams;
    expect(url).toBe("https://ifood.test/authentication/v1.0/oauth/userCode");
    expect(body.get("clientId")).toBe("client");
    expect(body.get("clientSecret")).toBe("secret");

    vi.unstubAllGlobals();
  });
});
