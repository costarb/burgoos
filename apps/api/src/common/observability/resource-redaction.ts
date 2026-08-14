const sensitiveKey = /token|secret|password|authorization|credential|card|pan|cvv|payload|raw/i;
const bearer = /bearer\s+[a-z0-9._~+/=-]+/gi;
const cardNumber = /\b(?:\d[ -]*?){13,19}\b/g;

export function redactResourceValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[TRUNCATED]";
  if (typeof value === "string") return redactResourceMessage(value);
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redactResourceValue(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 50)
        .map(([key, child]) => [key, sensitiveKey.test(key) ? "[REDACTED]" : redactResourceValue(child, depth + 1)]),
    );
  }
  return value;
}

export function redactResourceMessage(message: string, maxLength = 500): string {
  return message
    .replace(bearer, "Bearer [REDACTED]")
    .replace(cardNumber, "[REDACTED_CARD]")
    .slice(0, maxLength);
}
