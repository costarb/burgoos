import { describe, expect, it } from "vitest";
import { exportKey, fiscalKey, imageKey, isStoredAssetKey, tenantOfImageKey } from "./asset-keys";

const TENANT = "1b02924c-63ff-430a-a45d-df516a0bb5b4";
const UUID = "0b5c2f1e-7a7d-4f62-9a55-3c2f8f1f0a10";

describe("asset keys (spec 030 bucket layout)", () => {
  it("files fiscal documents by issue month in São Paulo time", () => {
    // 22:00 on Oct 31 in São Paulo is already Nov 1 in UTC.
    const lateOnTheLastDay = new Date("2026-11-01T01:00:00.000Z");
    expect(fiscalKey(TENANT, lateOnTheLastDay, "35261012345678000190650010000000011000000019", "xml")).toBe(
      `fiscal/${TENANT}/2026/10/35261012345678000190650010000000011000000019.xml`
    );
    expect(fiscalKey(TENANT, new Date("2026-11-16T15:00:00.000Z"), "abc", "cancel-xml")).toBe(
      `fiscal/${TENANT}/2026/11/abc-cancelamento.xml`
    );
    expect(fiscalKey(TENANT, new Date("2026-11-16T15:00:00.000Z"), "abc", "danfe")).toBe(
      `fiscal/${TENANT}/2026/11/abc.pdf`
    );
  });

  it("strips unsafe characters from the fiscal file name", () => {
    expect(fiscalKey(TENANT, new Date("2026-11-16T15:00:00.000Z"), "../x y", "xml")).toBe(`fiscal/${TENANT}/2026/11/xy.xml`);
  });

  it("puts images and exports under their type prefix", () => {
    expect(imageKey(TENANT, "PRODUCT_IMAGE", "jpg", UUID)).toBe(`images/${TENANT}/product/${UUID}.jpg`);
    expect(imageKey(TENANT, "BRANDING_LOGO", "png", UUID)).toBe(`images/${TENANT}/branding-logo/${UUID}.png`);
    expect(imageKey(TENANT, "PRODUCT_IMAGE", "webp")).toMatch(new RegExp(`^images/${TENANT}/product/[a-f0-9-]{36}\\.webp$`));
    expect(exportKey(TENANT, "job-1", "vendas.csv")).toBe(`exports/${TENANT}/job-1/vendas.csv`);
  });

  it("recognizes new and legacy image keys, but not URLs, base64 or fiscal keys", () => {
    expect(isStoredAssetKey(`images/${TENANT}/product/${UUID}.jpg`)).toBe(true);
    expect(isStoredAssetKey(`tenants/${TENANT}/images/product_image/${UUID}.jpeg`)).toBe(true);
    expect(isStoredAssetKey("https://cdn.example.com/a.jpg")).toBe(false);
    expect(isStoredAssetKey("data:image/png;base64,AAAA")).toBe(false);
    expect(isStoredAssetKey(`fiscal/${TENANT}/2026/11/abc.xml`)).toBe(false);
    expect(isStoredAssetKey(`images/${TENANT}/../${UUID}.jpg`)).toBe(false);
    expect(tenantOfImageKey(`images/${TENANT}/product/${UUID}.jpg`)).toBe(TENANT);
    expect(tenantOfImageKey(`tenants/${TENANT}/images/product_image/${UUID}.png`)).toBe(TENANT);
    expect(tenantOfImageKey("https://x")).toBeNull();
  });
});
