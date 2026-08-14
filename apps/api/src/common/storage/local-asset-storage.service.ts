import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  AssetStorage,
  AssetUploadIntent,
  AssetUploadIntentInput,
  AssetWriteInput,
  StoredAsset,
  assertSafeAssetKey,
} from "./asset-storage";

@Injectable()
export class LocalAssetStorageService implements AssetStorage {
  private readonly root: string;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    this.root = resolve(config.get<string>("ASSET_LOCAL_ROOT") ?? "tmp/assets");
  }

  async createUploadIntent(input: AssetUploadIntentInput): Promise<AssetUploadIntent> {
    assertSafeAssetKey(input.key);
    const apiBaseUrl = (this.config.get<string>("API_PUBLIC_URL") ?? "").replace(/\/$/, "");
    return {
      key: input.key,
      method: "PUT",
      uploadUrl: `${apiBaseUrl}/api/admin/assets/local-uploads/${encodeURIComponent(input.key)}`,
      headers: { "content-type": input.contentType },
      expiresAt: new Date(Date.now() + input.expiresInSeconds * 1_000),
    };
  }

  async write(input: AssetWriteInput): Promise<{ sizeBytes: number }> {
    const path = this.pathFor(input.key);
    await mkdir(dirname(path), { recursive: true });
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

    try {
      await pipeline(input.body, limiter, createWriteStream(path, { flags: "wx" }));
      return { sizeBytes };
    } catch (error) {
      await rm(path, { force: true });
      throw error;
    }
  }

  async read(key: string): Promise<StoredAsset> {
    const path = this.pathFor(key);
    const metadata = await stat(path);
    return { body: createReadStream(path), contentLength: metadata.size };
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  private pathFor(key: string): string {
    assertSafeAssetKey(key);
    const path = resolve(this.root, ...key.split("/"));
    if (path !== this.root && !path.startsWith(`${this.root}${sep}`)) {
      throw new Error("Asset key escapes storage root");
    }
    return path;
  }
}
