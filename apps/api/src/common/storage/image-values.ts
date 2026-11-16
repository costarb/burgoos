import { BadRequestException } from "@nestjs/common";
import { isStoredAssetKey, tenantOfImageKey, type ImageExtension } from "./asset-keys";
import { READ_URL_TTL_SECONDS, type AssetStorage } from "./asset-storage";

/**
 * Image values saved on products and on the store branding (spec 030, US4): an image key of the ERP
 * bucket, an external http(s) URL, or, only until the legacy migration, a base64 data URL.
 */

const LEGACY_DATA_URL = /^data:image\/(png|jpe?g|webp|gif);base64,/i;

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isImageDataUrl(value: string): boolean {
  return LEGACY_DATA_URL.test(value);
}

/**
 * Validates an image value sent by the admin. New base64 values are refused (FR-019): images go through
 * the upload. A legacy base64 value is accepted only when it is the value already stored (`current`), so
 * saving a form without touching the image keeps working before the migration. A key must belong to the
 * store that saves it.
 */
export function normalizeImageReference(
  value: string | null | undefined,
  options: { tenantId: string; label: string; current?: Array<string | null | undefined> }
): string | null | undefined {
  if (value === undefined) return undefined;
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;
  if (isStoredAssetKey(normalized)) {
    if (tenantOfImageKey(normalized) !== options.tenantId) {
      throw new BadRequestException(`${options.label}: imagem de outra loja`);
    }
    return normalized;
  }
  if (isHttpUrl(normalized)) return normalized;
  if (isImageDataUrl(normalized)) {
    if (options.current?.includes(normalized)) return normalized;
    throw new BadRequestException("Envie a imagem pelo upload");
  }
  throw new BadRequestException(`${options.label} deve ser uma URL ou uma imagem enviada pelo upload`);
}

/** URL ready for an `<img>`: signed read URL for a bucket key, the value itself otherwise. */
export async function resolveImageUrl(
  storage: AssetStorage | undefined,
  value: string | null | undefined
): Promise<string | null> {
  if (!value) return null;
  if (!isStoredAssetKey(value)) return value;
  if (!storage) return null;
  try {
    return await storage.createReadUrl(value, READ_URL_TTL_SECONDS);
  } catch {
    return null;
  }
}

export interface DecodedLegacyImage {
  body: Buffer;
  contentType: string;
  extension: ImageExtension;
}

const LEGACY_FORMATS: Record<string, { contentType: string; extension: ImageExtension }> = {
  png: { contentType: "image/png", extension: "png" },
  jpeg: { contentType: "image/jpeg", extension: "jpg" },
  jpg: { contentType: "image/jpeg", extension: "jpg" },
  webp: { contentType: "image/webp", extension: "webp" },
};

/** Decodes a legacy base64 image, checking the format and the decoded size. */
export function decodeLegacyImage(value: string, maxBytes: number): DecodedLegacyImage {
  const match = /^data:image\/([a-z]+);base64,/i.exec(value);
  const format = match ? LEGACY_FORMATS[match[1].toLowerCase()] : undefined;
  if (!match || !format) throw new Error("Formato de imagem nao suportado");
  const base64 = value.slice(match[0].length).replace(/\s/g, "");
  if (!/^[a-z0-9+/]*={0,2}$/i.test(base64)) throw new Error("Base64 invalido");
  if (Math.floor((base64.length * 3) / 4) > maxBytes + 2) throw new Error("Imagem acima do limite");
  const body = Buffer.from(base64, "base64");
  if (!body.length) throw new Error("Imagem vazia");
  if (body.length > maxBytes) throw new Error("Imagem acima do limite");
  return { body, ...format };
}
