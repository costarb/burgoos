import type { Request } from "express";
import { resolveMcpServerUrl } from "../admin/mcp-server-url";

export const MCP_OAUTH_SCOPE = "mcp:read";

export interface McpOAuthUrls {
  /** Canonical MCP server URI (RFC 8707 resource), without trailing slash. */
  resource: string;
  /** Authorization server issuer: origin of the public API. */
  issuer: string;
  protectedResourceMetadata: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  registrationEndpoint: string;
  revocationEndpoint: string;
  /** Web consent page (without query string). */
  consentPage: string;
}

/**
 * Derives every public OAuth URL from MCP_PUBLIC_URL (or the request, like the phase-1
 * snippets) so discovery documents, tokens and redirects always agree on the same origin.
 */
export function resolveMcpOAuthUrls(
  config: { mcpPublicUrl?: string; webPublicUrl?: string; webOrigin?: string },
  request: Request
): McpOAuthUrls {
  const resource = canonicalResource(resolveMcpServerUrl(config.mcpPublicUrl, request));
  const issuer = new URL(resource).origin;
  const api = `${issuer}/api/oauth`;
  return {
    resource,
    issuer,
    protectedResourceMetadata: `${issuer}/.well-known/oauth-protected-resource`,
    authorizationEndpoint: `${api}/authorize`,
    tokenEndpoint: `${api}/token`,
    registrationEndpoint: `${api}/register`,
    revocationEndpoint: `${api}/revoke`,
    consentPage: `${webBaseUrl(config)}/conectar/mcp`,
  };
}

export function canonicalResource(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  const path = url.pathname.replace(/\/+$/, "");
  return `${url.protocol}//${url.host.toLowerCase()}${path}`;
}

/** True when `value` names the same MCP server as `resource` (case of host and trailing slash ignored). */
export function matchesResource(value: string | undefined | null, resource: string): boolean {
  if (!value) return true;
  try {
    return canonicalResource(value) === canonicalResource(resource);
  } catch {
    return false;
  }
}

function webBaseUrl(config: { webPublicUrl?: string; webOrigin?: string }): string {
  const configured = config.webPublicUrl?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const firstOrigin = config.webOrigin
    ?.split(",")
    .map((origin) => origin.trim())
    .find(Boolean);
  return (firstOrigin ?? "http://localhost:3000").replace(/\/+$/, "");
}
