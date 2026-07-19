import { Injectable } from "@nestjs/common";
import {
  ProviderRangeInput,
  ProviderRangeResult,
  SalesProviderAdapter,
} from "../sales-provider.adapter";
import { PagBankEdiClient } from "./pagbank-edi.client";

@Injectable()
export class PagBankSalesProviderAdapter implements SalesProviderAdapter {
  readonly provider = "PAGBANK" as const;
  readonly channel = "API" as const;
  readonly capabilities = {
    provider: this.provider,
    channels: [this.channel],
    maxPeriodDays: 31,
    supportsPreview: true,
    requiredSettings: ["externalMerchantId", "token"],
  };
  constructor(private readonly client: PagBankEdiClient) {}
  async fetchRange(input: ProviderRangeInput): Promise<ProviderRangeResult> {
    const days = [];
    const end = new Date(`${input.endDate}T00:00:00.000Z`);
    for (
      let cursor = new Date(`${input.startDate}T00:00:00.000Z`);
      cursor <= end;
      cursor = new Date(cursor.getTime() + 86_400_000)
    ) {
      days.push(
        await this.client.fetchDay({
          date: cursor.toISOString().slice(0, 10),
          merchantId: input.merchantId,
          credential: input.credential,
        })
      );
    }
    return { startDate: input.startDate, endDate: input.endDate, days };
  }
}
