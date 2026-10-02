const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Redirect URIs a client may declare: https, or http on a loopback host (native apps, RFC 8252). */
export function isAllowedRedirectUri(value: string): boolean {
  const url = parse(value);
  if (!url || url.hash) return false;
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
}

/**
 * Exact match against the registered list, except that loopback redirects ignore the port
 * (RFC 8252 §7.3; Claude Code uses an ephemeral port on localhost or 127.0.0.1).
 */
export function matchesRegisteredRedirect(requested: string, registered: readonly string[]): boolean {
  if (registered.includes(requested)) return true;
  const target = parse(requested);
  if (!target || target.protocol !== "http:" || !LOOPBACK_HOSTS.has(target.hostname)) return false;
  return registered.some((candidate) => {
    const allowed = parse(candidate);
    return (
      !!allowed &&
      allowed.protocol === "http:" &&
      allowed.hostname === target.hostname &&
      allowed.pathname === target.pathname &&
      allowed.search === target.search
    );
  });
}

export function onlyLoopbackRedirects(registered: readonly string[]): boolean {
  return (
    registered.length > 0 &&
    registered.every((value) => {
      const url = parse(value);
      return !!url && LOOPBACK_HOSTS.has(url.hostname);
    })
  );
}

export function redirectHost(value: string): string {
  return parse(value)?.host ?? value;
}

/** Appends OAuth response parameters, preserving any query the client registered. */
export function buildRedirect(redirectUri: string, params: Record<string, string | undefined | null>): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  }
  return url.toString();
}

function parse(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
