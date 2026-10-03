import type { McpAuthorizationRequest } from "@rrfive/types";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";

export class McpConsentError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string
  ) {
    super(message);
    this.name = "McpConsentError";
  }
}

async function call<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as
    | (T & { message?: string | string[]; code?: string })
    | null;
  if (!response.ok) {
    const message = Array.isArray(body?.message) ? body.message.join("; ") : body?.message;
    throw new McpConsentError(
      response.status,
      message ?? "Nao foi possivel concluir a autorizacao.",
      body?.code
    );
  }
  return body as T;
}

export function getMcpAuthorizationRequest(accessToken: string, requestId: string) {
  return call<McpAuthorizationRequest>(accessToken, `/api/oauth/requests/${requestId}`);
}

export function approveMcpAuthorization(
  accessToken: string,
  requestId: string,
  storeId: string,
  allowActions = false
) {
  return call<{ redirectUrl: string }>(accessToken, `/api/oauth/requests/${requestId}/approve`, {
    method: "POST",
    body: JSON.stringify({ storeId, allowActions }),
  });
}

export function denyMcpAuthorization(accessToken: string, requestId: string) {
  return call<{ redirectUrl: string }>(accessToken, `/api/oauth/requests/${requestId}/deny`, {
    method: "POST",
  });
}
