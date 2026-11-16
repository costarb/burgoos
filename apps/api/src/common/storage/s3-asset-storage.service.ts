import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Readable } from "node:stream";
import {
  AssetStorage,
  AssetUploadIntent,
  AssetUploadIntentInput,
  AssetWriteInput,
  StoredAsset,
  assertSafeAssetKey,
} from "./asset-storage";

/** Multipart part size (S3/R2 minimum is 5 MiB for every part but the last). */
export const S3_PART_BYTES = 8 * 1024 * 1024;

@Injectable()
export class S3AssetStorageService implements AssetStorage {
  private readonly bucket: string;
  private readonly client: S3Client;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    this.bucket = config.get<string>("S3_BUCKET") ?? "";
    const accessKeyId = config.get<string>("S3_ACCESS_KEY_ID");
    const secretAccessKey = config.get<string>("S3_SECRET_ACCESS_KEY");
    this.client = new S3Client({
      region: config.get<string>("S3_REGION") ?? "us-east-1",
      endpoint: config.get<string>("S3_ENDPOINT") || undefined,
      forcePathStyle: config.get<string>("S3_FORCE_PATH_STYLE") === "true",
      // Default checksums of SDK >= 3.729 are not fully supported by R2 and other S3-compatible stores.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      credentials:
        accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    });
  }

  async createUploadIntent(input: AssetUploadIntentInput): Promise<AssetUploadIntent> {
    this.assertConfigured();
    assertSafeAssetKey(input.key);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: input.key,
      ContentType: input.contentType,
    });
    return {
      key: input.key,
      method: "PUT",
      uploadUrl: await getSignedUrl(this.client, command, { expiresIn: input.expiresInSeconds }),
      headers: { "content-type": input.contentType },
      expiresAt: new Date(Date.now() + input.expiresInSeconds * 1_000),
    };
  }

  /**
   * Writes a stream of unknown length. The SDK cannot sign a stream without a length (it fails with
   * `x-amz-decoded-content-length: undefined`), so the body is collected in parts: a body up to one part
   * goes in a single PutObject with a Buffer, a larger one (exports) goes as a multipart upload. Memory is
   * bounded by the part size, never by the file size.
   */
  async write(input: AssetWriteInput): Promise<{ sizeBytes: number }> {
    this.assertConfigured();
    assertSafeAssetKey(input.key);
    let sizeBytes = 0;
    let pending: Buffer[] = [];
    let pendingBytes = 0;
    let uploadId: string | undefined;
    const parts: { ETag?: string; PartNumber: number }[] = [];

    const uploadPart = async (body: Buffer): Promise<void> => {
      if (!uploadId) {
        const created = await this.client.send(
          new CreateMultipartUploadCommand({ Bucket: this.bucket, Key: input.key, ContentType: input.contentType })
        );
        uploadId = created.UploadId;
        if (!uploadId) throw new Error("S3 did not return an upload id");
      }
      const PartNumber = parts.length + 1;
      const result = await this.client.send(
        new UploadPartCommand({
          Bucket: this.bucket,
          Key: input.key,
          UploadId: uploadId,
          PartNumber,
          Body: body,
          ContentLength: body.length,
        })
      );
      parts.push({ ETag: result.ETag, PartNumber });
    };

    try {
      for await (const chunk of input.body as AsyncIterable<Buffer | string>) {
        const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
        sizeBytes += buffer.length;
        if (sizeBytes > input.maxBytes) throw new Error("Asset exceeds configured size limit");
        pending.push(buffer);
        pendingBytes += buffer.length;
        if (pendingBytes >= S3_PART_BYTES) {
          const body = Buffer.concat(pending);
          pending = [];
          pendingBytes = 0;
          await uploadPart(body);
        }
      }
      const rest = Buffer.concat(pending);
      if (!uploadId) {
        await this.client.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: input.key,
            Body: rest,
            ContentLength: rest.length,
            ContentType: input.contentType,
          })
        );
        return { sizeBytes };
      }
      if (rest.length) await uploadPart(rest);
      await this.client.send(
        new CompleteMultipartUploadCommand({
          Bucket: this.bucket,
          Key: input.key,
          UploadId: uploadId,
          MultipartUpload: { Parts: parts },
        })
      );
      return { sizeBytes };
    } catch (error) {
      if (uploadId) {
        await this.client
          .send(new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: input.key, UploadId: uploadId }))
          .catch(() => undefined);
      }
      input.body.destroy();
      throw error;
    }
  }

  async read(key: string): Promise<StoredAsset> {
    this.assertConfigured();
    assertSafeAssetKey(key);
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key })
    );
    if (!(result.Body instanceof Readable)) throw new Error("S3 object body is not streamable");
    return {
      body: result.Body,
      contentType: result.ContentType,
      contentLength: result.ContentLength,
    };
  }

  async delete(key: string): Promise<void> {
    this.assertConfigured();
    assertSafeAssetKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async exists(key: string): Promise<boolean> {
    this.assertConfigured();
    assertSafeAssetKey(key);
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (error) {
      const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (candidate.name === "NotFound" || candidate.$metadata?.httpStatusCode === 404) return false;
      throw error;
    }
  }

  async createReadUrl(key: string, expiresInSeconds: number): Promise<string> {
    this.assertConfigured();
    assertSafeAssetKey(key);
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }

  private assertConfigured(): void {
    if (!this.bucket) throw new Error("S3_BUCKET is required for S3 asset storage");
  }
}
