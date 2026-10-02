/**
 * Accepts only same-origin paths for post-login redirects ("/conectar/mcp?pedido=..."), so a
 * crafted link cannot send the user to another site after signing in.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if ([...value].some((char) => char.charCodeAt(0) < 0x20 || char === "\\")) return null;
  try {
    const parsed = new URL(value, "http://rrfive.local");
    if (parsed.origin !== "http://rrfive.local") return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}
