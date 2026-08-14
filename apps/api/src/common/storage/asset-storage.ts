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
}

export function assertSafeAssetKey(key: string): void {
  const segments = key.split("/");
  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9/_.-]{0,511}$/.test(key) ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error("Invalid asset key");
  }
}
