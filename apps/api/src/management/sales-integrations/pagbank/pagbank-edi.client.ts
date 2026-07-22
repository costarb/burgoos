import { Injectable } from "@nestjs/common";
import { ProviderDayResult, SalesProviderError } from "../sales-provider.adapter";
import { mapPagBankMovement } from "./pagbank-edi.mapper";
import { isPagBankEdiResponse } from "./pagbank-edi.types";
import { PagBankPlatformConfigurationService } from "../../../platform/integrations/pagbank-platform-configuration.service";

@Injectable()
export class PagBankEdiClient {
  constructor(private readonly configuration?: PagBankPlatformConfigurationService) {}

  async fetchDay(input: {
    date: string;
    merchantId: string;
    credential: string;
  }): Promise<ProviderDayResult> {
    const movements: ProviderDayResult["movements"] = [];
    let page = 1;
    let totalPages = 1;
    let totalElements = 0;
    let validated = false;
    do {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);
      let response: Response;
      try {
        const baseUrl = this.configuration
          ? await this.configuration.apiBaseUrl()
          : "https://edi.api.pagbank.com.br";
        response = await fetch(
          `${baseUrl.replace(/\/$/, "")}/movement/v3.00/transactional/${input.date}?pageNumber=${page}&pageSize=1000`,
          {
            headers: {
              Authorization: `Basic ${Buffer.from(`${input.merchantId}:${input.credential}`).toString("base64")}`,
              Accept: "application/json",
            },
            signal: controller.signal,
          }
        );
      } catch (error) {
        throw new SalesProviderError(
          error instanceof Error && error.name === "AbortError" ? "TIMEOUT" : "UNAVAILABLE",
          "PagBank temporariamente indisponivel",
          true
        );
      } finally {
        clearTimeout(timeout);
      }
      if (!response.ok) {
        if (response.status === 401 || response.status === 403)
          throw new SalesProviderError("AUTHENTICATION", "Credenciais PagBank recusadas", false);
        if (response.status === 429)
          throw new SalesProviderError("RATE_LIMIT", "Limite de consultas PagBank atingido", true);
        throw new SalesProviderError(
          "UNAVAILABLE",
          "PagBank temporariamente indisponivel",
          response.status >= 500
        );
      }
      const payload: unknown = await response.json();
      if (!isPagBankEdiResponse(payload))
        throw new SalesProviderError(
          "INCOMPATIBLE_RESPONSE",
          "Resposta PagBank incompativel",
          false
        );
      validated = response.headers.get("VALIDADO")?.toUpperCase() === "TRUE";
      totalPages = Math.max(1, payload.pagination.totalPages);
      totalElements = payload.pagination.totalElements;
      movements.push(...payload.detalhes.map(mapPagBankMovement));
      page += 1;
    } while (page <= totalPages);
    return {
      date: input.date,
      validated,
      pagesFetched: page - 1,
      totalPages,
      totalElements,
      movements,
    };
  }
}
