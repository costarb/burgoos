import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Readable, Transform } from "node:stream";
import {
  AssetStorage,
  AssetUploadIntent,
  AssetUploadIntentInput,
  AssetWriteInput,
  StoredAsset,
  assertSafeAssetKey,
} from "./asset-storage";

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

  async write(input: AssetWriteInput): Promise<{ sizeBytes: number }> {
    this.assertConfigured();
    assertSafeAssetKey(input.key);
    let sizeBytes = 0;
    const limiter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        sizeBytes += chunk.length;
        callback(
          sizeBytes > input.maxBytes ? new Error("Asset exceeds configured size limit") : null,
          chunk
        );
      },
    });
    input.body.pipe(limiter);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: limiter,
        ContentType: input.contentType,
      })
    );
    return { sizeBytes };
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

  private assertConfigured(): void {
    if (!this.bucket) throw new Error("S3_BUCKET is required for S3 asset storage");
  }
}
