import { randomUUID } from "node:crypto";
import { PassThrough, Readable } from "node:stream";
import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { ASSET_STORAGE, AssetStorage } from "./asset-storage";

export const IMAGE_ASSET_MAX_BYTES = 2 * 1024 * 1024;
export const IMAGE_ASSET_MAX_DIMENSION = 4096;
const INTENT_TTL_SECONDS = 300;
const HEADER_LIMIT = 64 * 1024;

export const imagePurposes = [
  "PRODUCT_IMAGE",
  "BRANDING_LOGO",
  "BRANDING_HEADER",
  "BRANDING_BODY",
  "BRANDING_FOOTER",
] as const;
export type ImagePurpose = (typeof imagePurposes)[number];
export type ImageContentType = "image/png" | "image/jpeg" | "image/webp";

export interface CreateImageUploadIntent {
  purpose: ImagePurpose;
  fileName: string;
  contentType: ImageContentType;
  sizeBytes: number;
  width: number;
  height: number;
}

interface PendingIntent extends CreateImageUploadIntent {
  tenantId: string;
  key: string;
  expiresAt: Date;
}

@Injectable()
export class AssetUploadService {
  private readonly intents = new Map<string, PendingIntent>();

  constructor(@Inject(ASSET_STORAGE) private readonly storage: AssetStorage) {}

  async createIntent(tenantId: string, input: CreateImageUploadIntent) {
    validateIntent(input);
    this.pruneExpired();
    const extension = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[input.contentType];
    const key = `tenants/${tenantId}/images/${input.purpose.toLowerCase()}/${randomUUID()}.${extension}`;
    const intent = await this.storage.createUploadIntent({
      key,
      contentType: input.contentType,
      maxBytes: IMAGE_ASSET_MAX_BYTES,
      expiresInSeconds: INTENT_TTL_SECONDS,
    });
    this.intents.set(key, { ...input, tenantId, key, expiresAt: intent.expiresAt });
    return {
      assetKey: key,
      method: intent.method,
      uploadUrl: intent.uploadUrl,
      headers: intent.headers,
      expiresAt: intent.expiresAt.toISOString(),
    };
  }

  async uploadLocal(tenantId: string, key: string, contentType: string, body: Readable): Promise<void> {
    const intent = this.requireIntent(tenantId, key);
    if (contentType !== intent.contentType) throw invalidImage("Content-Type diferente da intencao");
    const verifier = verifyingStream(intent);
    const stored = this.storage.write({
      key,
      body: body.pipe(verifier),
      contentType: intent.contentType,
      maxBytes: IMAGE_ASSET_MAX_BYTES,
    });
    try {
      await stored;
      verifier.verify();
    } catch (error) {
      await this.storage.delete(key).catch(() => undefined);
      throw error;
    }
  }

  async confirm(tenantId: string, key: string): Promise<{ assetKey: string }> {
    const intent = this.requireIntent(tenantId, key);
    const asset = await this.storage.read(key);
    const verifier = verifyingStream(intent);
    try {
      await drain(asset.body.pipe(verifier));
      verifier.verify();
      this.intents.delete(key);
      return { assetKey: key };
    } catch (error) {
      await this.storage.delete(key).catch(() => undefined);
      throw error;
    }
  }

  private requireIntent(tenantId: string, key: string): PendingIntent {
    this.pruneExpired();
    const intent = this.intents.get(key);
    if (!intent || intent.tenantId !== tenantId) throw new NotFoundException("Intencao de upload nao encontrada");
    return intent;
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [key, intent] of this.intents) if (intent.expiresAt.getTime() <= now) this.intents.delete(key);
  }
}

function validateIntent(input: CreateImageUploadIntent): void {
  if (!imagePurposes.includes(input.purpose)) throw invalidImage("Finalidade de imagem invalida");
  if (!["image/png", "image/jpeg", "image/webp"].includes(input.contentType)) throw invalidImage("Formato de imagem nao suportado");
  if (input.sizeBytes < 1 || input.sizeBytes > IMAGE_ASSET_MAX_BYTES) throw invalidImage("Imagem deve ter no maximo 2 MiB");
  if (input.width < 1 || input.height < 1 || input.width > IMAGE_ASSET_MAX_DIMENSION || input.height > IMAGE_ASSET_MAX_DIMENSION) {
    throw invalidImage("Imagem deve ter no maximo 4096 x 4096 pixels");
  }
}

function verifyingStream(intent: PendingIntent): PassThrough & { verify(): void } {
  let size = 0;
  const headers: Buffer[] = [];
  let headerBytes = 0;
  const stream = new PassThrough({
    transform(chunk: Buffer, _encoding, callback) {
      size += chunk.length;
      if (headerBytes < HEADER_LIMIT) {
        const part = chunk.subarray(0, HEADER_LIMIT - headerBytes);
        headers.push(part);
        headerBytes += part.length;
      }
      callback(size > IMAGE_ASSET_MAX_BYTES ? invalidImage("Imagem deve ter no maximo 2 MiB") : null, chunk);
    },
  }) as PassThrough & { verify(): void };
  stream.verify = () => {
    if (size !== intent.sizeBytes) throw invalidImage("Tamanho enviado diferente da intencao");
    const metadata = imageMetadata(Buffer.concat(headers));
    if (!metadata || metadata.contentType !== intent.contentType) throw invalidImage("Assinatura da imagem nao corresponde ao formato informado");
    if (metadata.width !== intent.width || metadata.height !== intent.height) throw invalidImage("Dimensoes da imagem diferentes da intencao");
  };
  return stream;
}

function imageMetadata(buffer: Buffer): { contentType: ImageContentType; width: number; height: number } | null {
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { contentType: "image/png", width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length >= 30 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    const kind = buffer.toString("ascii", 12, 16);
    if (kind === "VP8X") return { contentType: "image/webp", width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (marker !== undefined && marker >= 0xc0 && marker <= 0xc3) {
        return { contentType: "image/jpeg", width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
      }
      if (length < 2) break;
      offset += 2 + length;
    }
  }
  return null;
}

async function drain(stream: Readable): Promise<void> {
  for await (const _chunk of stream) { /* streaming validation */ }
}

function invalidImage(message: string): UnprocessableEntityException {
  return new UnprocessableEntityException(message);
}
