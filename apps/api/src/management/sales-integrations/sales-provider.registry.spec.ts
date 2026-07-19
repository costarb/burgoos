import { describe, expect, it } from "vitest";
import { SalesProviderRegistry } from "./sales-provider.registry";
import type { SalesProviderAdapter } from "./sales-provider.adapter";

const adapter: SalesProviderAdapter = {
  provider: "PAGBANK", channel: "API",
  capabilities: { provider: "PAGBANK", channels: ["API"], maxPeriodDays: 31, supportsPreview: true, requiredSettings: [] },
  fetchDay: async ({ date }) => ({ date, validated: true, pagesFetched: 1, totalPages: 1, totalElements: 0, movements: [] }),
};

describe("SalesProviderRegistry", () => {
  it("lists registered capabilities and resolves adapters", () => { const registry = new SalesProviderRegistry(); registry.register(adapter); expect(registry.get("PAGBANK")).toBe(adapter); expect(registry.listCapabilities()).toEqual([adapter.capabilities]); });
  it("rejects duplicate providers", () => { const registry = new SalesProviderRegistry(); registry.register(adapter); expect(() => registry.register(adapter)).toThrow(/ja registrado/); });
});
