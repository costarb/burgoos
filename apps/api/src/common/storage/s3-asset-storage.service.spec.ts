import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import { S3AssetStorageService } from "./s3-asset-storage.service";

function storage() {
  const service = new S3AssetStorageService(
    new ConfigService({
      S3_BUCKET: "assets",
      S3_REGION: "auto",
      S3_ENDPOINT: "https://account.r2.cloudflarestorage.com",
      S3_FORCE_PATH_STYLE: "true",
      S3_ACCESS_KEY_ID: "key",
      S3_SECRET_ACCESS_KEY: "secret",
    })
  );
  const send = vi.fn();
  (service as unknown as { client: { send: typeof send } }).client.send = send;
  return { service, send };
}

describe("S3AssetStorageService (spec 030 additions)", () => {
  it("checks existence with HeadObject and maps 404 to false", async () => {
    const { service, send } = storage();
    send.mockResolvedValueOnce({});
    expect(await service.exists("fiscal/t/2026/11/a.xml")).toBe(true);
    expect(send.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand);
    send.mockRejectedValueOnce(Object.assign(new Error("NotFound"), { name: "NotFound", $metadata: { httpStatusCode: 404 } }));
    expect(await service.exists("fiscal/t/2026/11/b.xml")).toBe(false);
    send.mockRejectedValueOnce(Object.assign(new Error("denied"), { name: "AccessDenied", $metadata: { httpStatusCode: 403 } }));
    await expect(service.exists("fiscal/t/2026/11/c.xml")).rejects.toThrow("denied");
  });

  it("creates a presigned GET URL for the key", async () => {
    const { service } = storage();
    const url = new URL(await service.createReadUrl("images/t/product/a.png", 3600));
    expect(url.pathname).toBe("/assets/images/t/product/a.png");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("3600");
    expect(url.searchParams.get("X-Amz-Signature")).toBeTruthy();
  });
});
