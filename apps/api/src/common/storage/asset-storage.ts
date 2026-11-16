import type { Readable } from "node:stream";

export const ASSET_STORAGE = Symbol("ASSET_STORAGE");

export interface AssetWriteInput {
  key: string;
  body: Readable;
  contentType: string;
  maxBytes: number;
}

export interface AssetUploadIntentInput {
  key: string;
  contentType: string;
  maxBytes: number;
  expiresInSeconds: number;
}

export interface AssetUploadIntent {
  key: string;
  method: "PUT";
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface StoredAsset {
  body: Readable;
  contentType?: string;
  contentLength?: number;
}

export interface AssetStorage {
  createUploadIntent(input: AssetUploadIntentInput): Promise<AssetUploadIntent>;
  write(input: AssetWriteInput): Promise<{ sizeBytes: number }>;
  read(key: string): Promise<StoredAsset>;
  delete(key: string): Promise<void>;
  /** True when the object exists (used by the fiscal file recovery, spec 030). */
  exists(key: string): Promise<boolean>;
  /**
   * Short-lived URL an `<img>` can load without the admin token: presigned GET on S3/R2, an HMAC
   * signed API URL on the local storage (spec 030).
   */
  createReadUrl(key: string, expiresInSeconds: number): Promise<string>;
}

/** Default lifetime of the image read URLs returned to the admin. */
export const READ_URL_TTL_SECONDS = 3600;

export function assertSafeAssetKey(key: string): void {
  const segments = key.split("/");
  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9/_.-]{0,511}$/.test(key) ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error("Invalid asset key");
  }
}
