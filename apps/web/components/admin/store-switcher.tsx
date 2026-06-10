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

  if (!session || session.allowedStores.length <= 1) {
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
    window.location.reload();
  }

  return (
    <label className="ml-auto flex items-center gap-2 text-xs font-medium text-slate-600">
      <Building2 aria-hidden className="h-4 w-4" />
      <select
        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900"
        onChange={(event) => void changeStore(event.target.value)}
        value={session.activeStoreId ?? session.allowedStores[0]?.id ?? ""}
      >
        {session.allowedStores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.name}
          </option>
        ))}
      </select>
    </label>
  );
}
