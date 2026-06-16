import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface IfoodTokenResponse {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt: Date;
  refreshExpiresAt?: Date | null;
  scopes?: string[];
  raw: Record<string, unknown>;
}

export interface IfoodUserCodeResponse {
  userCode: string;
  authorizationCodeVerifier: string;
  verificationUrl: string | null;
  verificationUrlComplete: string | null;
  expiresIn: number | null;
  raw: Record<string, unknown>;
}

@Injectable()
export class IfoodAuthService {
  constructor(private readonly config: ConfigService) {}

  async exchangeAuthorizationCode(input: {
    clientId: string;
    clientSecret: string;
    authorizationCode?: string | null;
    authorizationCodeVerifier?: string | null;
    refreshToken?: string | null;
  }): Promise<IfoodTokenResponse> {
    if (this.isMockMode()) {
      return this.mockToken(input.refreshToken);
    }

    const authBaseUrl = this.config.get<string>("IFOOD_AUTH_BASE_URL");
    if (!authBaseUrl) {
      throw new ServiceUnavailableException("IFOOD_AUTH_BASE_URL nao configurado");
    }

    const body = new URLSearchParams();
    body.set("clientId", input.clientId);
    body.set("clientSecret", input.clientSecret);

    if (input.refreshToken) {
      body.set("grantType", "refresh_token");
      body.set("refreshToken", input.refreshToken);
    } else if (input.authorizationCode) {
      if (!input.authorizationCodeVerifier) {
        throw new BadRequestException(
          "authorizationCodeVerifier e obrigatorio para salvar credenciais iFood com authorization code"
        );
      }
      body.set("grantType", "authorization_code");
      body.set("authorizationCode", input.authorizationCode);
      body.set("authorizationCodeVerifier", input.authorizationCodeVerifier);
    } else {
      throw new BadRequestException(
        "Gere o codigo iFood, autorize no portal e informe o authorization code antes de salvar credenciais"
      );
    }

    let response: Response;
    try {
      response = await fetch(this.tokenUrl(authBaseUrl), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
    } catch (error) {
      throw new BadGatewayException(
        `Nao foi possivel conectar ao iFood OAuth: ${
          error instanceof Error ? error.message : "falha desconhecida"
        }`
      );
    }

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      throw new BadGatewayException(
        `iFood OAuth recusou as credenciais com status ${response.status}${
          bodyText ? `: ${this.safeErrorBody(bodyText)}` : ""
        }`
      );
    }

    const payload = (await response.json()) as Record<string, unknown>;
    return this.toTokenResponse(payload);
  }

  async requestUserCode(input: {
    clientId: string;
    clientSecret: string;
  }): Promise<IfoodUserCodeResponse> {
    if (this.isMockMode()) {
      return {
        userCode: "MOCK-CODE",
        authorizationCodeVerifier: "mock-authorization-code-verifier",
        verificationUrl: "https://portal.ifood.com.br/apps/code",
        verificationUrlComplete: "https://portal.ifood.com.br/apps/code?c=MOCK-CODE",
        expiresIn: 600,
        raw: { mock: true },
      };
    }

    const authBaseUrl = this.config.get<string>("IFOOD_AUTH_BASE_URL");
    if (!authBaseUrl) {
      throw new ServiceUnavailableException("IFOOD_AUTH_BASE_URL nao configurado");
    }

    const body = new URLSearchParams();
    body.set("clientId", input.clientId);
    body.set("clientSecret", input.clientSecret);

    let response: Response;
    try {
      response = await fetch(this.userCodeUrl(authBaseUrl), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
    } catch (error) {
      throw new BadGatewayException(
        `Nao foi possivel conectar ao iFood OAuth: ${
          error instanceof Error ? error.message : "falha desconhecida"
        }`
      );
    }

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      throw new BadGatewayException(
        `iFood OAuth nao gerou codigo de usuario com status ${response.status}${
          bodyText ? `: ${this.safeErrorBody(bodyText)}` : ""
        }`
      );
    }

    const payload = (await response.json()) as Record<string, unknown>;
    return this.toUserCodeResponse(payload);
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

  private tokenUrl(authBaseUrl: string) {
    const normalized = authBaseUrl.replace(/\/+$/, "");
    return normalized.endsWith("/oauth/token") ? normalized : `${normalized}/oauth/token`;
  }

  private userCodeUrl(authBaseUrl: string) {
    const normalized = authBaseUrl.replace(/\/+$/, "");
    if (normalized.endsWith("/oauth/token")) {
      return `${normalized.slice(0, -"/oauth/token".length)}/oauth/userCode`;
    }
    return normalized.endsWith("/oauth/userCode") ? normalized : `${normalized}/oauth/userCode`;
  }

  private toUserCodeResponse(payload: Record<string, unknown>): IfoodUserCodeResponse {
    return {
      userCode: String(payload.userCode ?? ""),
      authorizationCodeVerifier: String(payload.authorizationCodeVerifier ?? ""),
      verificationUrl: typeof payload.verificationUrl === "string" ? payload.verificationUrl : null,
      verificationUrlComplete:
        typeof payload.verificationUrlComplete === "string"
          ? payload.verificationUrlComplete
          : null,
      expiresIn: Number.isFinite(Number(payload.expiresIn)) ? Number(payload.expiresIn) : null,
      raw: payload,
    };
  }

  private safeErrorBody(bodyText: string) {
    return bodyText
      .replace(/"accessToken"\s*:\s*"[^"]+"/gi, '"accessToken":"[redacted]"')
      .replace(/"access_token"\s*:\s*"[^"]+"/gi, '"access_token":"[redacted]"')
      .replace(/"refreshToken"\s*:\s*"[^"]+"/gi, '"refreshToken":"[redacted]"')
      .replace(/"refresh_token"\s*:\s*"[^"]+"/gi, '"refresh_token":"[redacted]"')
      .slice(0, 500);
  }
}
