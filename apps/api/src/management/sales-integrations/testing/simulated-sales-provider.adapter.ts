import { Injectable } from "@nestjs/common";
import type { SalesProviderAdapter } from "../sales-provider.adapter";

@Injectable()
export class SimulatedSalesProviderAdapter implements SalesProviderAdapter {
  readonly provider = "PAGBANK" as const;
  readonly channel = "OTHER" as const;
  readonly capabilities = { provider: this.provider, channels: [this.channel], maxPeriodDays: 7, supportsPreview: true, requiredSettings: [] };
  async fetchDay(input: { date: string }) { return { date: input.date, validated: true, pagesFetched: 1, totalPages: 1, totalElements: 0, movements: [] }; }
}
