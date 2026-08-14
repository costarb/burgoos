import { ConfigService } from "@nestjs/config";
import { readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { assertSafeAssetKey } from "./asset-storage";
import { LocalAssetStorageService } from "./local-asset-storage.service";

const storageRoot = resolve(process.cwd(), "tmp", "asset-storage-contract");

describe("AssetStorage local contract", () => {
  afterEach(async () => {
    await rm(storageRoot, { recursive: true, force: true });
  });

  it("streams a tenant-scoped asset and removes it", async () => {
    const storage = localStorage();
    const key = "tenants/tenant-1/branding/logo.png";

    await expect(
      storage.write({
        key,
        body: Readable.from([Buffer.from("image")]),
        contentType: "image/png",
        maxBytes: 10,
      })
    ).resolves.toEqual({ sizeBytes: 5 });
    expect(await readFile(join(storageRoot, ...key.split("/")), "utf8")).toBe("image");

    const stored = await storage.read(key);
    expect(stored.contentLength).toBe(5);
    const chunks: Buffer[] = [];
    for await (const chunk of stored.body) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString("utf8")).toBe("image");
    await storage.delete(key);
    await expect(storage.read(key)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("removes a partial file when the stream exceeds its limit", async () => {
    const storage = localStorage();
    const key = "tenants/tenant-1/oversized.png";
    await expect(
      storage.write({
        key,
        body: Readable.from([Buffer.alloc(11)]),
        contentType: "image/png",
        maxBytes: 10,
      })
    ).rejects.toThrow(/size limit/);
    await expect(readFile(join(storageRoot, ...key.split("/")))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("creates a bounded authenticated local upload URL", async () => {
    const intent = await localStorage().createUploadIntent({
      key: "tenants/tenant-1/products/product-1.webp",
      contentType: "image/webp",
      maxBytes: 100,
      expiresInSeconds: 60,
    });
    expect(intent).toEqual(
      expect.objectContaining({
        method: "PUT",
        uploadUrl:
          "http://localhost:3001/api/admin/assets/local-uploads/tenants%2Ftenant-1%2Fproducts%2Fproduct-1.webp",
        headers: { "content-type": "image/webp" },
      })
    );
  });

  it.each(["../secret", "/absolute", "tenant/../../secret", "tenant\\secret"])(
    "rejects unsafe key %s",
    (key) => expect(() => assertSafeAssetKey(key)).toThrow(/Invalid asset key/)
  );
});

function localStorage(): LocalAssetStorageService {
  return new LocalAssetStorageService(
    new ConfigService({
      ASSET_LOCAL_ROOT: storageRoot,
      API_PUBLIC_URL: "http://localhost:3001",
    })
  );
}
