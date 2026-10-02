import { createHash, randomBytes, timingSafeEqual } from "crypto";

export const ACCESS_TOKEN_PREFIX = "rrf_oat_";
export const REFRESH_TOKEN_PREFIX = "rrf_ort_";
export const AUTHORIZATION_CODE_PREFIX = "rrf_oac_";
export const DCR_CLIENT_PREFIX = "mcpc_";

export const ACCESS_TOKEN_TTL_SECONDS = 3_600;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 86_400;
export const AUTHORIZATION_CODE_TTL_SECONDS = 60;
export const AUTHORIZATION_REQUEST_TTL_SECONDS = 600;
export const MAX_ACTIVE_CONNECTIONS_PER_STORE = 20;

const OPAQUE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateOpaque(prefix: string): string {
  return `${prefix}${randomBytes(32).toString("base64url")}`;
}

export function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hasOpaqueShape(value: string, prefix: string): boolean {
  return value.startsWith(prefix) && OPAQUE_PATTERN.test(value.slice(prefix.length));
}

/** RFC 7636 S256: BASE64URL(SHA256(code_verifier)) === code_challenge, in constant time. */
export function verifyPkceS256(codeVerifier: string, codeChallenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(codeVerifier)) return false;
  const computed = Buffer.from(createHash("sha256").update(codeVerifier).digest("base64url"));
  const expected = Buffer.from(codeChallenge);
  return computed.length === expected.length && timingSafeEqual(computed, expected);
}

export function isValidCodeChallenge(value: string | undefined): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}
