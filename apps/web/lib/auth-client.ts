import type { AuthSession } from "@burgoos/types";

const AUTH_SESSION_KEY = "burgoos.admin.session";

export function readAuthSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_SESSION_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    window.localStorage.removeItem(AUTH_SESSION_KEY);
    return null;
  }
}

export function writeAuthSession(session: AuthSession): void {
  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

export function clearAuthSession(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(AUTH_SESSION_KEY);
  }
}

export function getAuthHeader(session = readAuthSession()): Record<string, string> {
  return session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {};
}
