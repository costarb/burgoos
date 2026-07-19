import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

export type IntegrationCredentialEnvelope =
  | { version: 1; kind: "PAGBANK_EDI"; ediToken: string }
  | { version: 1; kind: "MERCADO_PAGO_OAUTH"; accessToken: string; refreshToken: string }
  | { version: 1; kind: "MERCADO_PAGO_FIXED"; accessToken: string };

@Injectable()
export class IntegrationSecretService {
  constructor(private readonly config: ConfigService) {}

  encrypt(plainText: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key(), iv);
    const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
  }

  decrypt(cipherText: string): string {
    const buffer = Buffer.from(cipherText, "base64");
    if (buffer.length < 29) throw new InternalServerErrorException("Credencial invalida");
    const decipher = createDecipheriv("aes-256-gcm", this.key(), buffer.subarray(0, 12));
    decipher.setAuthTag(buffer.subarray(12, 28));
    return Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()]).toString("utf8");
  }

  encryptEnvelope(envelope: IntegrationCredentialEnvelope): string {
    return this.encrypt(JSON.stringify(envelope));
  }

  decryptEnvelope(cipherText: string): IntegrationCredentialEnvelope {
    let parsed: unknown;
    try {
      parsed = JSON.parse(this.decrypt(cipherText));
    } catch {
      throw new InternalServerErrorException("Envelope de credencial invalido");
    }
    if (!isCredentialEnvelope(parsed)) {
      throw new InternalServerErrorException("Envelope de credencial invalido");
    }
    return parsed;
  }

  fingerprint(secret: string): string {
    return createHash("sha256").update(secret).digest("hex").slice(0, 16);
  }

  redact(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.redact(item));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        /secret|token|password|authorization|code|verifier|signature/i.test(key)
          ? "********"
          : this.redact(item),
      ])
    );
  }

  private key(): Buffer {
    const configured =
      this.config.get<string>("INTEGRATION_SECRET_KEY") ??
      this.config.get<string>("DELIVERY_INTEGRATION_SECRET_KEY");
    if (configured) {
      const decoded = Buffer.from(configured, "base64");
      if (decoded.length === 32) return decoded;
      if (this.config.get<string>("NODE_ENV") === "production") {
        throw new InternalServerErrorException(
          "INTEGRATION_SECRET_KEY deve conter 32 bytes em base64"
        );
      }
      return createHash("sha256").update(configured).digest();
    }
    if (this.config.get<string>("NODE_ENV") === "production") {
      throw new InternalServerErrorException("INTEGRATION_SECRET_KEY obrigatoria em producao");
    }
    return createHash("sha256").update("burgoos-local-delivery-integration-secret").digest();
  }
}

function isCredentialEnvelope(value: unknown): value is IntegrationCredentialEnvelope {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (record.version !== 1 || typeof record.kind !== "string") return false;
  if (record.kind === "PAGBANK_EDI") return typeof record.ediToken === "string";
  if (record.kind === "MERCADO_PAGO_FIXED") return typeof record.accessToken === "string";
  return (
    record.kind === "MERCADO_PAGO_OAUTH" &&
    typeof record.accessToken === "string" &&
    typeof record.refreshToken === "string"
  );
}
