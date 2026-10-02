import type { Request } from "express";

/**
 * Public URL of the MCP endpoint shown in the admin snippets. `MCP_PUBLIC_URL` wins; otherwise it
 * is derived from the incoming request, honoring the proxy's forwarded protocol and host.
 */
export function resolveMcpServerUrl(configured: string | undefined, request: Request): string {
  if (configured?.trim()) return configured.trim();

  const forwardedProto = firstHeader(request.headers["x-forwarded-proto"]);
  const forwardedHost = firstHeader(request.headers["x-forwarded-host"]);
  const protocol = forwardedProto ?? request.protocol ?? "http";
  const host = forwardedHost ?? request.get("host") ?? "localhost:3001";
  return `${protocol}://${host}/api/mcp`;
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const first = raw?.split(",")[0]?.trim();
  return first || undefined;
}
