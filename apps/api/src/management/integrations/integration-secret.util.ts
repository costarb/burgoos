const SECRET_KEYS = ["secret", "token", "password", "authorization", "clientSecret"];

export function redactIntegrationSecret(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (value.length <= 8) {
    return "********";
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function redactIntegrationPayload<T>(payload: T): T {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => redactIntegrationPayload(item)) as T;
  }

  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => {
      const shouldRedact = SECRET_KEYS.some((secretKey) =>
        key.toLowerCase().includes(secretKey.toLowerCase())
      );

      if (shouldRedact) {
        return [key, "********"];
      }

      return [key, redactIntegrationPayload(value)];
    })
  ) as T;
}
