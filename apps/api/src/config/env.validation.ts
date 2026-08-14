type Environment = Record<string, unknown>;

const MERCADO_PAGO_KEYS = [
  "MERCADO_PAGO_CLIENT_ID",
  "MERCADO_PAGO_CLIENT_SECRET",
  "MERCADO_PAGO_REDIRECT_URI",
] as const;

const APP_ROLES = ["api", "worker", "all"] as const;
const STORAGE_PROVIDERS = ["local", "s3"] as const;
const DURABLE_HANDLER_FLAGS = [
  "EXPORT_DURABLE_JOBS_ENABLED",
  "SALES_IMPORT_DURABLE_JOBS_ENABLED",
  "PROVIDER_WEBHOOK_DURABLE_JOBS_ENABLED",
  "PAYMENT_WEBHOOK_DURABLE_JOBS_ENABLED",
  "IFOOD_DURABLE_JOBS_ENABLED",
  "MP_RECONCILIATION_DURABLE_JOBS_ENABLED",
  "MP_REFRESH_DURABLE_JOBS_ENABLED",
  "POINT_RECONCILIATION_DURABLE_JOBS_ENABLED",
  "RETENTION_DURABLE_JOBS_ENABLED",
] as const;

const INTEGER_DEFAULTS = {
  MEMORY_SAMPLE_INTERVAL_MS: 30_000,
  MEMORY_WARNING_RSS_MB: 400,
  MEMORY_HIGH_RSS_MB: 440,
  MEMORY_PEAK_RSS_MB: 460,
  MEMORY_PRESSURE_CONSECUTIVE_SAMPLES: 2,
  BACKGROUND_JOB_CONCURRENCY: 1,
  BACKGROUND_JOB_BATCH_SIZE: 25,
  BACKGROUND_JOB_LEASE_MS: 60_000,
  BACKGROUND_JOB_MAX_ATTEMPTS: 5,
  BACKGROUND_JOB_POLL_INTERVAL_MS: 1_000,
  ASSET_MAX_IMAGE_BYTES: 2_097_152,
  ASSET_MAX_IMAGE_WIDTH: 4_096,
  ASSET_MAX_IMAGE_HEIGHT: 4_096,
  EXPORT_RETENTION_DAYS: 7,
  EXPORT_BATCH_SIZE: 250,
  RETENTION_BATCH_SIZE: 250,
  RETENTION_DEADLINE_MS: 5_000,
} as const;

export function validateEnvironment(input: Environment): Environment {
  const env = { ...input };
  env.APP_ROLE = enumValue(env.APP_ROLE, "APP_ROLE", APP_ROLES, "all");
  env.ASSET_STORAGE_PROVIDER = enumValue(
    env.ASSET_STORAGE_PROVIDER,
    "ASSET_STORAGE_PROVIDER",
    STORAGE_PROVIDERS,
    "local"
  );

  for (const [key, fallback] of Object.entries(INTEGER_DEFAULTS)) {
    env[key] = positiveInteger(env[key], key, fallback);
  }
  for (const key of DURABLE_HANDLER_FLAGS) {
    env[key] = booleanString(env[key], key, "false");
  }

  const warning = env.MEMORY_WARNING_RSS_MB as number;
  const high = env.MEMORY_HIGH_RSS_MB as number;
  const peak = env.MEMORY_PEAK_RSS_MB as number;
  if (!(warning < high && high < peak && peak < 512)) {
    throw new Error(
      "Memory RSS thresholds must satisfy warning < high < peak < 512 MB"
    );
  }

  env.API_BODY_LIMIT = nonEmpty(env.API_BODY_LIMIT) ? env.API_BODY_LIMIT.trim() : "2mb";
  env.ASSET_LOCAL_ROOT = nonEmpty(env.ASSET_LOCAL_ROOT) ? env.ASSET_LOCAL_ROOT.trim() : "tmp/assets";

  if (env.ASSET_STORAGE_PROVIDER === "s3") {
    for (const key of ["S3_REGION", "S3_BUCKET"] as const) {
      if (!nonEmpty(env[key])) throw new Error(`${key} is required for S3 asset storage`);
    }
  }
  const configuredCredentialKeys = [
    "MERCADO_PAGO_CLIENT_ID",
    "MERCADO_PAGO_CLIENT_SECRET",
  ] as const;
  const hasOAuthCredential = configuredCredentialKeys.some((key) => nonEmpty(env[key]));
  const configuredOAuthKeys = MERCADO_PAGO_KEYS.filter((key) => nonEmpty(env[key]));

  if (hasOAuthCredential && configuredOAuthKeys.length !== MERCADO_PAGO_KEYS.length) {
    throw new Error(
      "Mercado Pago OAuth requires MERCADO_PAGO_CLIENT_ID, MERCADO_PAGO_CLIENT_SECRET and MERCADO_PAGO_REDIRECT_URI together"
    );
  }

  validateHttpUrl(env, "MERCADO_PAGO_REDIRECT_URI");
  validateHttpUrl(env, "MERCADO_PAGO_POST_CALLBACK_URL");
  validateHttpUrl(env, "MERCADO_PAGO_API_BASE_URL");
  validateHttpUrl(env, "PAGBANK_EDI_BASE_URL");

  return env;
}

function booleanString(value: unknown, key: string, fallback: "true" | "false"): "true" | "false" {
  if (value === undefined || value === null || value === "") return fallback;
  if (value === true || value === "true") return "true";
  if (value === false || value === "false") return "false";
  throw new Error(`${key} must be true or false`);
}

function validateHttpUrl(env: Environment, key: string): void {
  const value = env[key];
  if (!nonEmpty(value)) return;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${key} must be an absolute HTTP(S) URL`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${key} must be an absolute HTTP(S) URL`);
  }
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function positiveInteger(value: unknown, key: string, fallback: number): number {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer`);
  }
  return parsed;
}

function enumValue<const T extends readonly string[]>(
  value: unknown,
  key: string,
  allowed: T,
  fallback: T[number]
): T[number] {
  const normalized = nonEmpty(value) ? value.trim().toLowerCase() : fallback;
  if (!allowed.includes(normalized as T[number])) {
    throw new Error(`${key} must be one of: ${allowed.join(", ")}`);
  }
  return normalized as T[number];
}
