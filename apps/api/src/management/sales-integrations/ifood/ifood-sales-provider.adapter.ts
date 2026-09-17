import { Injectable } from "@nestjs/common";
import {
  ProviderRangeInput,
  ProviderRangeResult,
  SalesProviderAdapter,
} from "../sales-provider.adapter";
import { IfoodFinancialClient } from "./ifood-financial.client";
import { mapIfoodSale, merchantDate } from "./ifood-sales.mapper";

@Injectable()
export class IfoodSalesProviderAdapter implements SalesProviderAdapter {
  readonly provider = "IFOOD" as const;
  readonly channel = "API" as const;
  readonly capabilities = {
    provider: this.provider,
    channels: [this.channel],
    maxPeriodDays: 90,
    supportsPreview: true,
    requiredSettings: ["deliveryIntegrationId"],
  };

  constructor(private readonly client: IfoodFinancialClient) {}

  async fetchRange(input: ProviderRangeInput): Promise<ProviderRangeResult> {
    const result = await this.client.fetchSales({
      accessToken: input.credential,
      merchantId: input.merchantId,
      startDate: input.startDate,
      endDate: input.endDate,
    });
    const grouped = new Map<string, ReturnType<typeof mapIfoodSale>[]>();
    for (const sale of result.sales) {
      const date = merchantDate(sale.createdAt, sale.merchant.timezone);
      grouped.set(date, [...(grouped.get(date) ?? []), mapIfoodSale(sale)]);
    }
    const days = [];
    const end = new Date(`${input.endDate}T00:00:00.000Z`);
    for (
      let cursor = new Date(`${input.startDate}T00:00:00.000Z`);
      cursor <= end;
      cursor = new Date(cursor.getTime() + 86_400_000)
    ) {
      const date = cursor.toISOString().slice(0, 10);
      days.push({
        date,
        validated: true,
        pagesFetched: result.pagesFetched,
        totalPages: result.totalPages,
        totalElements: result.totalElements,
        movements: grouped.get(date) ?? [],
      });
    }
    return { startDate: input.startDate, endDate: input.endDate, days };
  }
}
