import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface IfoodTokenResponse {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt: Date;
  refreshExpiresAt?: Date | null;
  scopes?: string[];
  raw: Record<string, unknown>;
}

@Injectable()
export class IfoodAuthService {
  constructor(private readonly config: ConfigService) {}

  async exchangeAuthorizationCode(input: {
    clientId: string;
    clientSecret: string;
    authorizationCode?: string | null;
    refreshToken?: string | null;
  }): Promise<IfoodTokenResponse> {
    if (this.isMockMode()) {
      return this.mockToken(input.refreshToken);
    }

    const authBaseUrl = this.config.get<string>("IFOOD_AUTH_BASE_URL");
    if (!authBaseUrl) {
      throw new Error("IFOOD_AUTH_BASE_URL is not configured");
    }

    const body = new URLSearchParams();
    body.set("clientId", input.clientId);
    body.set("clientSecret", input.clientSecret);

    if (input.refreshToken) {
      body.set("grantType", "refresh_token");
      body.set("refreshToken", input.refreshToken);
    } else {
      body.set("grantType", "authorization_code");
      body.set("authorizationCode", input.authorizationCode ?? "");
    }

    const response = await fetch(`${authBaseUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!response.ok) {
      throw new Error(`iFood authentication failed with status ${response.status}`);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    return this.toTokenResponse(payload);
  }

  private mockToken(refreshToken?: string | null): IfoodTokenResponse {
    const now = Date.now();
    return {
      accessToken: "mock-ifood-access-token",
      refreshToken: refreshToken ?? "mock-ifood-refresh-token",
      expiresAt: new Date(now + 3 * 60 * 60 * 1000),
      refreshExpiresAt: new Date(now + 7 * 24 * 60 * 60 * 1000),
      scopes: ["merchant", "order"],
      raw: { mock: true, expiresIn: 10800 },
    };
  }

  private toTokenResponse(payload: Record<string, unknown>): IfoodTokenResponse {
    const accessToken = String(payload.accessToken ?? payload.access_token ?? "");
    if (!accessToken) {
      throw new Error("iFood token response did not include access token");
    }

    const expiresIn = Number(payload.expiresIn ?? payload.expires_in ?? 0);
    const refreshExpiresIn = Number(payload.refreshExpiresIn ?? payload.refresh_expires_in ?? 0);
    const refreshToken = payload.refreshToken ?? payload.refresh_token;

    return {
      accessToken,
      refreshToken: refreshToken ? String(refreshToken) : null,
      expiresAt: new Date(Date.now() + Math.max(expiresIn, 1) * 1000),
      refreshExpiresAt:
        refreshExpiresIn > 0 ? new Date(Date.now() + refreshExpiresIn * 1000) : null,
      scopes: Array.isArray(payload.scope)
        ? payload.scope.map(String)
        : typeof payload.scope === "string"
          ? payload.scope.split(" ")
          : undefined,
      raw: payload,
    };
  }

  private isMockMode() {
    return this.config.get<string>("IFOOD_MOCK_MODE") === "true";
  }
}
