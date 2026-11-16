import { randomUUID } from "node:crypto";

/**
 * Single source of the bucket layout (spec 030): type first, then store, so each type can have its
 * own bucket rule by prefix (exports expire in 7 days, fiscal files are locked for 5 years).
 *
 *   fiscal/{tenantId}/{yyyy}/{mm}/{name}.xml | -cancelamento.xml | .pdf
 *   images/{tenantId}/{purpose}/{uuid}.{ext}
 *   exports/{tenantId}/{jobId}/{fileName}
 */

const BUSINESS_TIME_ZONE = "America/Sao_Paulo";

export type FiscalFileKind = "xml" | "danfe" | "cancel-xml";

export type ImageKeyPurpose =
  | "PRODUCT_IMAGE"
  | "BRANDING_LOGO"
  | "BRANDING_HEADER"
  | "BRANDING_BODY"
  | "BRANDING_FOOTER";

export type ImageExtension = "png" | "jpg" | "webp";

const IMAGE_FOLDER: Record<ImageKeyPurpose, string> = {
  PRODUCT_IMAGE: "product",
  BRANDING_LOGO: "branding-logo",
  BRANDING_HEADER: "branding-header",
  BRANDING_BODY: "branding-body",
  BRANDING_FOOTER: "branding-footer",
};

/** Year and month of the issue date in the business time zone (a note at 22:00 on the 31st stays in that month). */
function businessYearMonth(date: Date): { year: string; month: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  return {
    year: parts.find((part) => part.type === "year")?.value ?? String(date.getUTCFullYear()),
    month: parts.find((part) => part.type === "month")?.value ?? String(date.getUTCMonth() + 1).padStart(2, "0"),
  };
}

export function fiscalKey(tenantId: string, issuedAt: Date, name: string, kind: FiscalFileKind): string {
  const { year, month } = businessYearMonth(issuedAt);
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "");
  const suffix = kind === "danfe" ? ".pdf" : kind === "cancel-xml" ? "-cancelamento.xml" : ".xml";
  return `fiscal/${tenantId}/${year}/${month}/${safeName}${suffix}`;
}

export function imageKey(
  tenantId: string,
  purpose: ImageKeyPurpose,
  extension: ImageExtension,
  id: string = randomUUID()
): string {
  return `images/${tenantId}/${IMAGE_FOLDER[purpose]}/${id}.${extension}`;
}

export function exportKey(tenantId: string, jobId: string, fileName: string): string {
  return `exports/${tenantId}/${jobId}/${fileName}`;
}

const UUID = "[a-f0-9-]+";
const IMAGE_FILE = `${UUID}\\.(png|jpe?g|webp)`;
const IMAGE_KEY = new RegExp(`^images/${UUID}/(product|branding-(logo|header|body|footer))/${IMAGE_FILE}$`, "i");
/** Layout used before spec 030 (`tenants/{id}/images/{purpose}/...`); still readable. */
const LEGACY_IMAGE_KEY = new RegExp(`^tenants/${UUID}/images/[a-z_]+/${IMAGE_FILE}$`, "i");

/** True for an image stored in the ERP bucket (new or legacy layout), as opposed to a URL or base64. */
export function isStoredAssetKey(value: string): boolean {
  return IMAGE_KEY.test(value) || LEGACY_IMAGE_KEY.test(value);
}

/** Tenant that owns an image key (new or legacy layout), or null. */
export function tenantOfImageKey(value: string): string | null {
  if (!isStoredAssetKey(value)) return null;
  return value.split("/")[1] ?? null;
}
