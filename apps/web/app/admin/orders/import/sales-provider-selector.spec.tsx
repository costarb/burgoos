import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SalesProviderSelector } from "./sales-provider-selector";

describe("SalesProviderSelector", () => {
  it("renders only declared providers, channels and period capabilities", () => {
    const html = renderToStaticMarkup(<SalesProviderSelector providers={[{ provider: "PAGBANK", channels: ["API"], maxPeriodDays: 31, supportsPreview: true, requiredSettings: ["externalMerchantId", "credential"] }]} selectedProvider="PAGBANK" onChange={vi.fn()} />);
    expect(html).toContain("PAGBANK");
    expect(html).toContain("Canal: API");
    expect(html).toContain("31 dias");
    expect(html).not.toContain("FILE");
  });
});
