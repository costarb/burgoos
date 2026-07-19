import { Injectable } from "@nestjs/common";
import {
  ProviderRangeInput,
  ProviderRangeResult,
  SalesProviderAdapter,
} from "../sales-provider.adapter";
import { MercadoPagoClient } from "./mercado-pago.client";
import { mapMercadoPagoPayment } from "./mercado-pago.mapper";
import { MercadoPagoAuthenticatedRequestService } from "./mercado-pago-authenticated-request.service";

@Injectable()
export class MercadoPagoSalesProviderAdapter implements SalesProviderAdapter {
  readonly provider = "MERCADO_PAGO" as const;
  readonly channel = "API" as const;
  readonly capabilities = {
    provider: this.provider,
    channels: [this.channel],
    maxPeriodDays: 364,
    supportsPreview: true,
    requiredSettings: [],
  };
  constructor(
    private readonly client: MercadoPagoClient,
    private readonly authenticated?: MercadoPagoAuthenticatedRequestService
  ) {}
  async fetchRange(input: ProviderRangeInput): Promise<ProviderRangeResult> {
    const request = (accessToken: string) =>
      this.client.searchPayments({
        accessToken,
        startDate: input.startDate,
        endDate: input.endDate,
      });
    const payments =
      this.authenticated && input.merchantId
        ? await this.authenticated.execute({
            tenantId: input.merchantId.split(":", 2)[0],
            integrationId: input.merchantId.split(":", 2)[1],
            request,
          })
        : await request(input.credential);
    const grouped = new Map<string, ReturnType<typeof mapMercadoPagoPayment>[]>();
    for (const payment of payments) {
      const date = (payment.date_created ?? input.startDate).slice(0, 10);
      grouped.set(date, [...(grouped.get(date) ?? []), mapMercadoPagoPayment(payment)]);
    }
    const days = [];
    const end = new Date(`${input.endDate}T00:00:00.000Z`);
    for (
      let cursor = new Date(`${input.startDate}T00:00:00.000Z`);
      cursor <= end;
      cursor = new Date(cursor.getTime() + 86_400_000)
    ) {
      const date = cursor.toISOString().slice(0, 10);
      const movements = grouped.get(date) ?? [];
      days.push({
        date,
        validated: true,
        pagesFetched: 1,
        totalPages: 1,
        totalElements: movements.length,
        movements,
      });
    }
    return { startDate: input.startDate, endDate: input.endDate, days };
  }
}
