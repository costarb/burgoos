"use client";

import { Building2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { AuthSession } from "@burgoos/types";
import { readAuthSession, writeAuthSession } from "../../lib/auth-client";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";

export function StoreSwitcher() {
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    setSession(readAuthSession());
  }, []);

  const allowedStores = session?.allowedStores ?? [];

  if (!session || allowedStores.length <= 1) {
    return null;
  }

  async function changeStore(storeId: string) {
    if (!session) {
      return;
    }

    const response = await fetch(`${apiUrl}/api/admin/session/store`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ storeId, refreshToken: session.refreshToken }),
    });

    if (!response.ok) {
      return;
    }

    const updatedSession = (await response.json()) as AuthSession;
    writeAuthSession(updatedSession);
    setSession(updatedSession);
    invalidateStoreScopedState(window, updatedSession.activeStoreId ?? null);
  }

  return (
    <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
      <Building2 aria-hidden className="h-4 w-4" />
      <select
        className="h-9 max-w-48 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900"
        onChange={(event) => void changeStore(event.target.value)}
        value={session.activeStoreId ?? allowedStores[0]?.id ?? ""}
      >
        {allowedStores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function invalidateStoreScopedState(
  target: Pick<Window, "dispatchEvent"> & { location: { reload(): void } },
  storeId: string | null,
) {
  target.dispatchEvent(new CustomEvent("burgoos:store-changed", {
    detail: { storeId },
  }));
  target.location.reload();
}
