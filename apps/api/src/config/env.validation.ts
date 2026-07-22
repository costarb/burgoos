type Environment = Record<string, unknown>;

const MERCADO_PAGO_KEYS = [
  "MERCADO_PAGO_CLIENT_ID",
  "MERCADO_PAGO_CLIENT_SECRET",
  "MERCADO_PAGO_REDIRECT_URI",
] as const;

export function validateEnvironment(input: Environment): Environment {
  const env = { ...input };
  const configuredOAuthKeys = MERCADO_PAGO_KEYS.filter((key) => nonEmpty(env[key]));

  if (configuredOAuthKeys.length > 0 && configuredOAuthKeys.length !== MERCADO_PAGO_KEYS.length) {
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
