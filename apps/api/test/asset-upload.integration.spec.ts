import { Readable } from "node:stream";
import { NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AssetUploadService } from "../src/common/storage/asset-upload.service";

describe("bounded image asset uploads", () => {
  it("creates a short-lived tenant-scoped intent and accepts a matching streamed PNG", async () => {
    const storage = storageMock();
    const service = new AssetUploadService(storage as never);
    const image = pngHeader(320, 180);
    const intent = await service.createIntent("tenant-1", input(image.length, 320, 180));

    expect(intent.assetKey).toMatch(/^tenants\/tenant-1\/images\/product_image\/.+\.png$/);
    expect(new Date(intent.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(300_000);
    await service.uploadLocal("tenant-1", intent.assetKey, "image/png", Readable.from(image));

    expect(storage.write).toHaveBeenCalledWith(expect.objectContaining({
      key: intent.assetKey,
      maxBytes: 2 * 1024 * 1024,
    }));
  });

  it.each([
    [{ ...input(1, 1, 1), contentType: "image/gif" }, "Formato"],
    [input(2 * 1024 * 1024 + 1, 1, 1), "2 MiB"],
    [input(1, 4097, 1), "4096"],
  ])("rejects invalid intent metadata before storage", async (candidate, message) => {
    const storage = storageMock();
    const service = new AssetUploadService(storage as never);
    await expect(service.createIntent("tenant-1", candidate as never)).rejects.toThrow(message);
    expect(storage.createUploadIntent).not.toHaveBeenCalled();
  });

  it("rejects cross-tenant use and mismatched file signatures", async () => {
    const storage = storageMock();
    const service = new AssetUploadService(storage as never);
    const image = pngHeader(10, 20);
    const intent = await service.createIntent("tenant-1", input(image.length, 10, 20));

    await expect(
      service.uploadLocal("tenant-2", intent.assetKey, "image/png", Readable.from(image)),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.uploadLocal("tenant-1", intent.assetKey, "image/png", Readable.from(Buffer.alloc(image.length))),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(storage.delete).toHaveBeenCalledWith(intent.assetKey);
  });

  it("rejects an expired intent", async () => {
    const storage = storageMock(new Date(Date.now() - 1));
    const service = new AssetUploadService(storage as never);
    const intent = await service.createIntent("tenant-1", input(24, 1, 1));
    await expect(
      service.uploadLocal("tenant-1", intent.assetKey, "image/png", Readable.from(pngHeader(1, 1))),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

function input(sizeBytes: number, width: number, height: number) {
  return {
    purpose: "PRODUCT_IMAGE" as const,
    fileName: "product.png",
    contentType: "image/png" as const,
    sizeBytes,
    width,
    height,
  };
}

function pngHeader(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buffer);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function storageMock(expiresAt = new Date(Date.now() + 300_000)) {
  return {
    createUploadIntent: vi.fn(async ({ key, contentType }) => ({
      key,
      method: "PUT" as const,
      uploadUrl: `http://localhost/upload/${encodeURIComponent(key)}`,
      headers: { "content-type": contentType },
      expiresAt,
    })),
    write: vi.fn(async ({ body }) => {
      let sizeBytes = 0;
      for await (const chunk of body) sizeBytes += Buffer.byteLength(chunk);
      return { sizeBytes };
    }),
    read: vi.fn(),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}
