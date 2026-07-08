import type { AuthSession } from "@burgoos/types";

const AUTH_SESSION_KEY = "burgoos.admin.session";
const AUTH_ACCESS_COOKIE = "burgoos.admin.access_token";
const SESSION_REFRESH_THRESHOLD_MS = 30 * 60 * 1000;
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";

export function readAuthSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_SESSION_KEY);

  if (!raw) {
    return null;
  }

  try {
    return normalizeAuthSession(JSON.parse(raw) as Partial<AuthSession>);
  } catch {
    window.localStorage.removeItem(AUTH_SESSION_KEY);
    return null;
  }
}

export function writeAuthSession(session: AuthSession): void {
  const normalizedSession = normalizeAuthSession(session);

  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(normalizedSession));
  document.cookie = `${AUTH_ACCESS_COOKIE}=${encodeURIComponent(
    normalizedSession.accessToken
  )}; Path=/; SameSite=Lax`;
}

export function clearAuthSession(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(AUTH_SESSION_KEY);
    document.cookie = `${AUTH_ACCESS_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
}

export function getAuthHeader(session = readAuthSession()): Record<string, string> {
  return session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {};
}

export function isAuthSessionExpiring(
  session: AuthSession,
  thresholdMs = SESSION_REFRESH_THRESHOLD_MS
): boolean {
  const expiresAt = Date.parse(session.accessTokenExpiresAt);

  if (!Number.isFinite(expiresAt)) {
    return true;
  }

  return expiresAt - Date.now() <= thresholdMs;
}

export async function refreshAuthSession(session = readAuthSession()): Promise<AuthSession | null> {
  if (!session?.refreshToken) {
    return session;
  }

  const response = await fetch(`${apiUrl}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });

  if (!response.ok) {
    clearAuthSession();
    return null;
  }

  const refreshedSession = normalizeAuthSession((await response.json()) as Partial<AuthSession>);
  writeAuthSession(refreshedSession);
  return refreshedSession;
}

export async function refreshAuthSessionIfNeeded(
  session = readAuthSession(),
  thresholdMs = SESSION_REFRESH_THRESHOLD_MS
): Promise<AuthSession | null> {
  if (!session) {
    return null;
  }

  if (!isAuthSessionExpiring(session, thresholdMs)) {
    return session;
  }

  return refreshAuthSession(session);
}

function normalizeAuthSession(session: Partial<AuthSession>): AuthSession {
  return {
    accessToken: session.accessToken ?? "",
    refreshToken: session.refreshToken,
    user: session.user ?? {
      id: "",
      login: "",
      name: "",
      email: "",
      status: "INACTIVE",
      isMaster: false,
    },
    activeStoreId: session.activeStoreId ?? null,
    allowedStores: session.allowedStores ?? [],
    permissions: session.permissions ?? [],
    accessTokenExpiresAt: session.accessTokenExpiresAt ?? new Date(0).toISOString(),
  };
}
