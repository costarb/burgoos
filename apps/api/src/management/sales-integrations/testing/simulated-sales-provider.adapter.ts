import { Injectable } from "@nestjs/common";
import type { SalesProviderAdapter } from "../sales-provider.adapter";

@Injectable()
export class SimulatedSalesProviderAdapter implements SalesProviderAdapter {
  readonly provider = "PAGBANK" as const;
  readonly channel = "OTHER" as const;
  readonly capabilities = {
    provider: this.provider,
    channels: [this.channel],
    maxPeriodDays: 7,
    supportsPreview: true,
    requiredSettings: [],
  };
  async fetchRange(input: { startDate: string; endDate: string }) {
    const days = [];
    const end = new Date(`${input.endDate}T00:00:00.000Z`);
    for (
      let cursor = new Date(`${input.startDate}T00:00:00.000Z`);
      cursor <= end;
      cursor = new Date(cursor.getTime() + 86_400_000)
    ) {
      days.push({
        date: cursor.toISOString().slice(0, 10),
        validated: true,
        pagesFetched: 1,
        totalPages: 1,
        totalElements: 0,
        movements: [],
      });
    }
    return { startDate: input.startDate, endDate: input.endDate, days };
  }
}
