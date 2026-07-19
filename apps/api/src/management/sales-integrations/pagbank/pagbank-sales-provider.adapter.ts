import { Injectable } from "@nestjs/common";
import { SalesProviderAdapter } from "../sales-provider.adapter";
import { PagBankEdiClient } from "./pagbank-edi.client";

@Injectable()
export class PagBankSalesProviderAdapter implements SalesProviderAdapter {
  readonly provider = "PAGBANK" as const;
  readonly channel = "API" as const;
  readonly capabilities = { provider: this.provider, channels: [this.channel], maxPeriodDays: 31, supportsPreview: true, requiredSettings: ["externalMerchantId", "token"] };
  constructor(private readonly client: PagBankEdiClient) {}
  fetchDay(input: { date: string; merchantId: string; credential: string }) { return this.client.fetchDay(input); }
}
