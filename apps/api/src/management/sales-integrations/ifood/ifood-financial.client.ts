import { Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SalesProviderError } from "../sales-provider.adapter";
import { IfoodFinancialObservabilityService } from "./ifood-financial-observability.service";
import {
  IfoodFinancialEvent,
  IfoodFinancialSale,
  IfoodReconciliationFileResponse,
  IfoodSettlementsResponse,
  parseIfoodFinancialEventsPage,
  parseIfoodReconciliationFile,
  parseIfoodSalesPage,
  parseIfoodSettlements,
} from "./ifood-financial.types";

type IfoodEndpoint = "sales" | "financial-events" | "settlements" | "reconciliation-on-demand";

export interface IfoodSalesRangeResult {
  sales: IfoodFinancialSale[];
  pagesFetched: number;
  totalPages: number;
  totalElements: number;
}

@Injectable()
export class IfoodFinancialClient {
  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly observability?: IfoodFinancialObservabilityService
  ) {}

  async fetchSales(input: {
    accessToken: string;
    merchantId: string;
    startDate: string;
    endDate: string;
  }): Promise<IfoodSalesRangeResult> {
    this.validateRange(input.startDate, input.endDate);
    const found = new Map<string, IfoodFinancialSale>();
    let page = 0;
    let pageCount = 1;
    let totalElements = 0;
    do {
      const url = new URL(`${this.baseUrl()}/v3/sales`);
      url.search = new URLSearchParams({
        merchantId: input.merchantId,
        beginSalesDate: input.startDate,
        endSalesDate: input.endDate,
        page: String(page),
      }).toString();
      const startedAt = Date.now();
      const response = await this.request(url, input.accessToken, undefined, {
        merchantId: input.merchantId,
        endpoint: "sales",
      });
      let parsed;
      try {
        parsed = parseIfoodSalesPage(await response.json());
      } catch {
        throw new SalesProviderError(
          "INCOMPATIBLE_RESPONSE",
          "Resposta da API Sales iFood incompativel",
          false
        );
      }
      if (parsed.page !== page) {
        throw new SalesProviderError("INCOMPATIBLE_RESPONSE", "Pagina iFood inesperada", false);
      }
      pageCount = parsed.pageCount;
      totalElements = parsed.total;
      for (const sale of parsed.sales) found.set(sale.id, sale);
      this.observability?.pageFetched({
        merchantId: input.merchantId,
        endpoint: "sales",
        page,
        pageCount,
        durationMs: Date.now() - startedAt,
      });
      page += 1;
    } while (page < pageCount);
    return { sales: [...found.values()], pagesFetched: page, totalPages: pageCount, totalElements };
  }

  async fetchFinancialEvents(input: {
    accessToken: string;
    merchantId: string;
    startDate: string;
    endDate: string;
  }) {
    this.validateRange(input.startDate, input.endDate, 33, "Financial Events");
    const events: IfoodFinancialEvent[] = [];
    let page = 1;
    let hasNextPage = true;
    while (hasNextPage) {
      const url = this.url("/v3/financial-events", {
        merchantId: input.merchantId,
        beginDate: input.startDate,
        endDate: input.endDate,
        page: String(page),
        size: "500",
      });
      const startedAt = Date.now();
      const parsed = parseIfoodFinancialEventsPage(
        await (
          await this.request(url, input.accessToken, undefined, {
            merchantId: input.merchantId,
            endpoint: "financial-events",
          })
        ).json()
      );
      if (parsed.page !== page)
        throw new SalesProviderError("INCOMPATIBLE_RESPONSE", "Pagina iFood inesperada", false);
      events.push(...parsed.financialEvents);
      hasNextPage = parsed.hasNextPage || Boolean(parsed.totalPages && page < parsed.totalPages);
      this.observability?.pageFetched({
        merchantId: input.merchantId,
        endpoint: "financial-events",
        page,
        pageCount: parsed.totalPages,
        durationMs: Date.now() - startedAt,
      });
      page += 1;
    }
    return { events, pagesFetched: page - 1 };
  }

  async fetchSettlements(input: {
    accessToken: string;
    merchantId: string;
    startDate: string;
    endDate: string;
  }): Promise<IfoodSettlementsResponse> {
    this.validateRange(input.startDate, input.endDate, 90, "Settlements");
    const url = this.url("/v3/settlements", {
      merchantId: input.merchantId,
      beginDate: input.startDate,
      endDate: input.endDate,
    });
    return parseIfoodSettlements(
      await (
        await this.request(url, input.accessToken, undefined, {
          merchantId: input.merchantId,
          endpoint: "settlements",
        })
      ).json()
    );
  }

  async requestReconciliationFile(input: {
    accessToken: string;
    merchantId: string;
    competence: string;
  }): Promise<IfoodReconciliationFileResponse> {
    const response = await this.request(
      this.url("/v3/reconciliation-on-demand"),
      input.accessToken,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ merchantId: input.merchantId, competencia: input.competence }),
      },
      { merchantId: input.merchantId, endpoint: "reconciliation-on-demand" }
    );
    return parseIfoodReconciliationFile(await response.json());
  }

  async getReconciliationFile(input: {
    accessToken: string;
    requestId: string;
  }): Promise<IfoodReconciliationFileResponse> {
    const response = await this.request(
      this.url(`/v3/reconciliation-on-demand/${encodeURIComponent(input.requestId)}`),
      input.accessToken
    );
    return parseIfoodReconciliationFile(await response.json());
  }

  private validateRange(startDate: string, endDate: string, maximumDays = 90, label = "Sales") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      throw new RangeError("Informe as datas iFood no formato YYYY-MM-DD");
    }
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T00:00:00.000Z`);
    const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    if (!Number.isFinite(days) || days < 1 || days > maximumDays) {
      throw new RangeError(
        `O periodo da API ${label} iFood deve ter entre 1 e ${maximumDays} dias`
      );
    }
  }

  private async request(
    url: URL,
    accessToken: string,
    init: RequestInit = {},
    context?: { merchantId: string; endpoint: IfoodEndpoint }
  ): Promise<Response> {
    const timeout = this.config.get<number>("IFOOD_FINANCIAL_TIMEOUT_MS") ?? 15_000;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      let response: Response;
      try {
        response = await fetch(url, {
          ...init,
          headers: {
            ...init.headers,
            Authorization: `Bearer ${accessToken}`,
            ...(this.config.get<boolean>("IFOOD_FINANCIAL_HOMOLOGATION")
              ? { "x-ifood-homologation": "true" }
              : {}),
          },
          signal: AbortSignal.timeout(timeout),
        });
      } catch (error) {
        if (attempt < 2) {
          this.reportRetry(context, attempt + 1, "TIMEOUT", 0);
          continue;
        }
        throw new SalesProviderError(
          "TIMEOUT",
          error instanceof Error && error.name !== "TimeoutError"
            ? "Falha de rede ao consultar vendas iFood"
            : "Tempo limite ao consultar vendas iFood",
          true
        );
      }
      if (response.ok) return response;
      if (response.status === 401 || response.status === 403) {
        throw new SalesProviderError(
          "AUTHENTICATION",
          response.status === 403
            ? "Credencial sem permissao para o merchant financeiro iFood"
            : "Credencial financeira iFood expirada ou invalida",
          false
        );
      }
      if (response.status !== 429 && response.status < 500) {
        throw new SalesProviderError("INCOMPATIBLE_RESPONSE", "Consulta iFood rejeitada", false);
      }
      if (attempt === 2) {
        throw new SalesProviderError(
          response.status === 429 ? "RATE_LIMIT" : "UNAVAILABLE",
          "API Financeira iFood temporariamente indisponivel",
          true
        );
      }
      const retryAfter = Number(response.headers.get("retry-after"));
      const delayMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : 200 * 2 ** attempt;
      this.reportRetry(context, attempt + 1, response.status === 429 ? "RATE_LIMIT" : "UNAVAILABLE", delayMs);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    throw new SalesProviderError("UNAVAILABLE", "API Financeira iFood indisponivel", true);
  }

  private reportRetry(
    context: { merchantId: string; endpoint: IfoodEndpoint } | undefined,
    attempt: number,
    reason: "TIMEOUT" | "RATE_LIMIT" | "UNAVAILABLE",
    delayMs: number
  ) {
    if (!context) return;
    this.observability?.retryAttempted({
      merchantId: context.merchantId,
      endpoint: context.endpoint,
      attempt,
      reason,
      delayMs,
    });
  }

  private baseUrl() {
    return (
      this.config.get<string>("IFOOD_FINANCIAL_BASE_URL") ??
      "https://merchant-api.ifood.com.br/financial"
    ).replace(/\/+$/, "");
  }

  private url(path: string, query?: Record<string, string>) {
    const url = new URL(`${this.baseUrl()}${path}`);
    if (query) url.search = new URLSearchParams(query).toString();
    return url;
  }
}
