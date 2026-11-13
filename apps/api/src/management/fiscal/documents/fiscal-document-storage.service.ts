import { Inject, Injectable } from "@nestjs/common";
import { Readable } from "node:stream";
import { ASSET_STORAGE, AssetStorage } from "../../../common/storage/asset-storage";

const MAX_BYTES = 5 * 1024 * 1024;

export type FiscalFileKind = "xml" | "danfe" | "cancel-xml";

/** Copies of XML/DANFE kept in the ERP storage so documents survive a provider switch. */
@Injectable()
export class FiscalDocumentStorageService {
  constructor(@Inject(ASSET_STORAGE) private readonly storage: AssetStorage) {}

  key(tenantId: string, issuedAt: Date, name: string, kind: FiscalFileKind): string {
    const year = issuedAt.getUTCFullYear();
    const month = String(issuedAt.getUTCMonth() + 1).padStart(2, "0");
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "");
    const suffix = kind === "danfe" ? ".pdf" : kind === "cancel-xml" ? "-cancelamento.xml" : ".xml";
    return `fiscal/${tenantId}/${year}/${month}/${safeName}${suffix}`;
  }

  async save(key: string, content: Buffer, kind: FiscalFileKind): Promise<string> {
    await this.storage.write({
      key,
      body: Readable.from(content),
      contentType: kind === "danfe" ? "application/pdf" : "application/xml",
      maxBytes: MAX_BYTES,
    });
    return key;
  }

  async read(key: string): Promise<Buffer> {
    const asset = await this.storage.read(key);
    const chunks: Buffer[] = [];
    for await (const chunk of asset.body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks);
  }
}
