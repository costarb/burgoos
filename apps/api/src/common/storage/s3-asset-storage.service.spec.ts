import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  HeadObjectCommand,
  PutObjectCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { PassThrough, Readable } from "node:stream";
import { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import { S3_PART_BYTES, S3AssetStorageService } from "./s3-asset-storage.service";

function config() {
  return new ConfigService({
      S3_BUCKET: "assets",
      S3_REGION: "auto",
      S3_ENDPOINT: "https://account.r2.cloudflarestorage.com",
      S3_FORCE_PATH_STYLE: "true",
      S3_ACCESS_KEY_ID: "key",
      S3_SECRET_ACCESS_KEY: "secret",
  });
}

function storage() {
  const service = new S3AssetStorageService(config());
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

  it("signs a small stream with a known length (R2 rejected aws-chunked without length)", async () => {
    const service = new S3AssetStorageService(config());
    const requests: { headers: Record<string, string>; body: unknown }[] = [];
    const client = (service as unknown as { client: { config: { requestHandler: unknown } } }).client;
    client.config.requestHandler = {
      handle: async (request: { headers: Record<string, string>; body: unknown }) => {
        requests.push(request);
        return { response: { statusCode: 200, headers: {}, body: Readable.from([]) } };
      },
    };
    const body = new PassThrough();
    body.end(Buffer.from("<nfeProc/>"));

    expect(await service.write({ key: "fiscal/t/2026-11/a.xml", body, contentType: "application/xml", maxBytes: 1024 })).toEqual({ sizeBytes: 10 });
    expect(requests).toHaveLength(1);
    expect(requests[0].headers["content-length"]).toBe("10");
    expect(requests[0].headers["x-amz-decoded-content-length"]).toBeUndefined();
    expect(requests[0].headers["content-encoding"]).toBeUndefined();
  });

  it("uploads a body larger than one part as multipart", async () => {
    const { service, send } = storage();
    send.mockImplementation(async (command: unknown) => {
      if (command instanceof CreateMultipartUploadCommand) return { UploadId: "up-1" };
      if (command instanceof UploadPartCommand) return { ETag: `"e${command.input.PartNumber}"` };
      return {};
    });
    const chunk = Buffer.alloc(S3_PART_BYTES / 2, 1);
    const body = Readable.from([chunk, chunk, chunk]);

    const result = await service.write({ key: "exports/t/j/f.csv", body, contentType: "text/csv", maxBytes: S3_PART_BYTES * 4 });

    expect(result.sizeBytes).toBe(chunk.length * 3);
    const commands = send.mock.calls.map(([command]) => command);
    expect(commands.map((command) => command.constructor)).toEqual([
      CreateMultipartUploadCommand,
      UploadPartCommand,
      UploadPartCommand,
      CompleteMultipartUploadCommand,
    ]);
    expect(commands[1].input.ContentLength).toBe(S3_PART_BYTES);
    expect(commands[2].input.ContentLength).toBe(S3_PART_BYTES / 2);
    expect(commands[3].input.MultipartUpload.Parts).toEqual([
      { ETag: '"e1"', PartNumber: 1 },
      { ETag: '"e2"', PartNumber: 2 },
    ]);
    expect(commands.some((command) => command instanceof PutObjectCommand)).toBe(false);
  });

  it("rejects a body over the limit and aborts the multipart upload", async () => {
    const { service, send } = storage();
    send.mockImplementation(async (command: unknown) =>
      command instanceof CreateMultipartUploadCommand ? { UploadId: "up-2" } : { ETag: '"e"' }
    );
    const chunk = Buffer.alloc(S3_PART_BYTES, 1);
    const body = Readable.from([chunk, chunk]);

    await expect(
      service.write({ key: "exports/t/j/g.csv", body, contentType: "text/csv", maxBytes: S3_PART_BYTES + 10 })
    ).rejects.toThrow("Asset exceeds configured size limit");
    expect(send.mock.calls.at(-1)?.[0]).toBeInstanceOf(AbortMultipartUploadCommand);
  });
});
