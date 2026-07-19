import { BadGatewayException, Injectable, UnauthorizedException } from "@nestjs/common";
import { MercadoPagoPlatformConfigurationService } from "../../../platform/integrations/mercado-pago-platform-configuration.service";
import {
  MercadoPagoAccountResponse,
  MercadoPagoOAuthTokenRequest,
  MercadoPagoOAuthTokenResponse,
  MercadoPagoPayment,
} from "./mercado-pago.types";
import { SalesProviderError } from "../sales-provider.adapter";

@Injectable()
export class MercadoPagoClient {
  private readonly baseUrl = "https://api.mercadopago.com";

  constructor(private readonly configuration: MercadoPagoPlatformConfigurationService) {}

  async exchangeAuthorizationCode(input: {
    code: string;
    codeVerifier: string;
  }): Promise<MercadoPagoOAuthTokenResponse> {
    return this.token({
      client_id: await this.configuration.required("clientId"),
      client_secret: await this.configuration.required("clientSecret"),
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: await this.configuration.required("redirectUri"),
      code_verifier: input.codeVerifier,
    });
  }

  async refreshAuthorization(refreshToken: string): Promise<MercadoPagoOAuthTokenResponse> {
    return this.token({
      client_id: await this.configuration.required("clientId"),
      client_secret: await this.configuration.required("clientSecret"),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
  }

  async validateAccessToken(accessToken: string): Promise<MercadoPagoAccountResponse> {
    const response = await fetch(`${this.baseUrl}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.status === 401 || response.status === 403)
      throw new UnauthorizedException("Access token Mercado Pago invalido");
    if (!response.ok)
      throw new BadGatewayException("Nao foi possivel validar a conta Mercado Pago");
    return response.json() as Promise<MercadoPagoAccountResponse>;
  }

  async searchPayments(input: {
    accessToken: string;
    startDate: string;
    endDate: string;
    limit?: number;
    rangeField?: "date_created" | "date_last_updated";
  }): Promise<MercadoPagoPayment[]> {
    const start = new Date(
      input.startDate.includes("T") ? input.startDate : `${input.startDate}T00:00:00.000Z`
    );
    const end = new Date(
      input.endDate.includes("T") ? input.endDate : `${input.endDate}T23:59:59.999Z`
    );
    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      end < start ||
      end.getTime() - start.getTime() >= 365 * 86_400_000
    )
      throw new RangeError("Periodo Mercado Pago deve ser menor que 365 dias");
    const limit = Math.min(100, Math.max(1, input.limit ?? 50));
    const found = new Map<string, MercadoPagoPayment>();
    let offset = 0;
    for (;;) {
      const url = new URL(`${this.baseUrl}/v1/payments/search`);
      const rangeField = input.rangeField ?? "date_created";
      url.search = new URLSearchParams({
        sort: rangeField,
        criteria: "asc",
        range: rangeField,
        begin_date: start.toISOString(),
        end_date: end.toISOString(),
        limit: String(limit),
        offset: String(offset),
      }).toString();
      const response = await this.fetchWithRetry(url, input.accessToken);
      const page = (await response.json()) as {
        paging: { total: number };
        results: MercadoPagoPayment[];
      };
      for (const payment of page.results) found.set(String(payment.id), payment);
      if (offset + page.results.length >= page.paging.total || page.results.length === 0) break;
      offset += page.results.length;
    }
    const field = input.rangeField === "date_last_updated" ? "date_last_updated" : "date_created";
    return [...found.values()].sort(
      (a, b) => String(a[field] ?? "").localeCompare(String(b[field] ?? "")) || a.id - b.id
    );
  }

  async getPayment(accessToken: string, paymentId: string): Promise<MercadoPagoPayment> {
    const response = await this.fetchWithRetry(
      new URL(`${this.baseUrl}/v1/payments/${encodeURIComponent(paymentId)}`),
      accessToken
    );
    return response.json() as Promise<MercadoPagoPayment>;
  }

  private async fetchWithRetry(url: URL, accessToken: string): Promise<Response> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (response.ok) return response;
      if (response.status === 401 || response.status === 403)
        throw new SalesProviderError("AUTHENTICATION", "Mercado Pago recusou a credencial", false);
      if (response.status !== 429 && response.status < 500)
        throw new SalesProviderError(
          "INCOMPATIBLE_RESPONSE",
          "Resposta Mercado Pago invalida",
          false
        );
      if (attempt === 2)
        throw new SalesProviderError(
          response.status === 429 ? "RATE_LIMIT" : "UNAVAILABLE",
          "Mercado Pago temporariamente indisponivel",
          true
        );
      await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
    }
    throw new SalesProviderError("UNAVAILABLE", "Mercado Pago temporariamente indisponivel", true);
  }

  private async token(body: MercadoPagoOAuthTokenRequest): Promise<MercadoPagoOAuthTokenResponse> {
    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok)
      throw new BadGatewayException("Nao foi possivel concluir a autorizacao Mercado Pago");
    return response.json() as Promise<MercadoPagoOAuthTokenResponse>;
  }
}
