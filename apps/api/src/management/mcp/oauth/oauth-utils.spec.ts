import { createHash, randomBytes } from "crypto";
import { describe, expect, it } from "vitest";
import {
  ACCESS_TOKEN_PREFIX,
  generateOpaque,
  hashSecret,
  hasOpaqueShape,
  isValidCodeChallenge,
  verifyPkceS256,
} from "./oauth-tokens.util";
import { canonicalResource, matchesResource, resolveMcpOAuthUrls } from "./oauth-urls";
import {
  buildRedirect,
  isAllowedRedirectUri,
  matchesRegisteredRedirect,
  onlyLoopbackRedirects,
  redirectHost,
} from "./redirect-uri";

function pkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

describe("OAuth token utils", () => {
  it("generates opaque prefixed tokens and hashes them", () => {
    const token = generateOpaque(ACCESS_TOKEN_PREFIX);
    expect(hasOpaqueShape(token, ACCESS_TOKEN_PREFIX)).toBe(true);
    expect(hasOpaqueShape("rrf_oat_curto", ACCESS_TOKEN_PREFIX)).toBe(false);
    expect(hashSecret(token)).toHaveLength(64);
  });

  it("verifies PKCE S256", () => {
    const { verifier, challenge } = pkcePair();
    expect(isValidCodeChallenge(challenge)).toBe(true);
    expect(verifyPkceS256(verifier, challenge)).toBe(true);
    expect(verifyPkceS256(pkcePair().verifier, challenge)).toBe(false);
    expect(verifyPkceS256("curto", challenge)).toBe(false);
    expect(isValidCodeChallenge("plain-value")).toBe(false);
  });
});

describe("OAuth URLs", () => {
  const request = { headers: {}, protocol: "http", get: () => "localhost:3001" } as never;

  it("derives issuer, endpoints and consent page from MCP_PUBLIC_URL", () => {
    const urls = resolveMcpOAuthUrls(
      { mcpPublicUrl: "https://API.example.com/api/mcp/", webPublicUrl: "https://app.example.com/" },
      request
    );
    expect(urls).toEqual({
      resource: "https://api.example.com/api/mcp",
      issuer: "https://api.example.com",
      protectedResourceMetadata: "https://api.example.com/.well-known/oauth-protected-resource",
      authorizationEndpoint: "https://api.example.com/api/oauth/authorize",
      tokenEndpoint: "https://api.example.com/api/oauth/token",
      registrationEndpoint: "https://api.example.com/api/oauth/register",
      revocationEndpoint: "https://api.example.com/api/oauth/revoke",
      consentPage: "https://app.example.com/conectar/mcp",
    });
  });

  it("falls back to the request and the first web origin", () => {
    const urls = resolveMcpOAuthUrls({ webOrigin: "http://localhost:3000,http://127.0.0.1:3000" }, request);
    expect(urls.resource).toBe("http://localhost:3001/api/mcp");
    expect(urls.consentPage).toBe("http://localhost:3000/conectar/mcp");
  });

  it("matches resources ignoring host case and trailing slash", () => {
    expect(canonicalResource("https://Api.Example.com/api/mcp/")).toBe("https://api.example.com/api/mcp");
    expect(matchesResource("https://api.example.com/api/mcp/", "https://api.example.com/api/mcp")).toBe(true);
    expect(matchesResource(undefined, "https://api.example.com/api/mcp")).toBe(true);
    expect(matchesResource("https://other.example.com/api/mcp", "https://api.example.com/api/mcp")).toBe(false);
    expect(matchesResource("nao-e-url", "https://api.example.com/api/mcp")).toBe(false);
  });
});

describe("redirect URIs", () => {
  it("allows https and loopback http only", () => {
    expect(isAllowedRedirectUri("https://claude.ai/api/mcp/auth_callback")).toBe(true);
    expect(isAllowedRedirectUri("http://localhost/callback")).toBe(true);
    expect(isAllowedRedirectUri("http://127.0.0.1:4000/callback")).toBe(true);
    expect(isAllowedRedirectUri("http://evil.example.com/callback")).toBe(false);
    expect(isAllowedRedirectUri("https://claude.ai/cb#frag")).toBe(false);
    expect(isAllowedRedirectUri("javascript:alert(1)")).toBe(false);
  });

  it("matches exactly, ignoring only the port of loopback redirects", () => {
    const registered = ["https://claude.ai/api/mcp/auth_callback", "http://localhost/callback", "http://127.0.0.1/callback"];
    expect(matchesRegisteredRedirect("https://claude.ai/api/mcp/auth_callback", registered)).toBe(true);
    expect(matchesRegisteredRedirect("http://localhost:3118/callback", registered)).toBe(true);
    expect(matchesRegisteredRedirect("http://127.0.0.1:50000/callback", registered)).toBe(true);
    expect(matchesRegisteredRedirect("http://localhost:3118/other", registered)).toBe(false);
    expect(matchesRegisteredRedirect("https://claude.ai/api/mcp/auth_callback/x", registered)).toBe(false);
    expect(matchesRegisteredRedirect("https://claude.ai:8443/api/mcp/auth_callback", registered)).toBe(false);
  });

  it("detects loopback-only clients, hosts and builds redirects", () => {
    expect(onlyLoopbackRedirects(["http://localhost/callback"])).toBe(true);
    expect(onlyLoopbackRedirects(["http://localhost/callback", "https://claude.ai/cb"])).toBe(false);
    expect(redirectHost("https://chatgpt.com/connector_platform_oauth_redirect")).toBe("chatgpt.com");
    expect(buildRedirect("https://claude.ai/cb?x=1", { code: "abc", state: "s", iss: undefined })).toBe(
      "https://claude.ai/cb?x=1&code=abc&state=s"
    );
  });
});
