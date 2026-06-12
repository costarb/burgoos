"use client";

import type { AuthSession } from "@burgoos/types";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clearAuthSession, readAuthSession } from "../../lib/auth-client";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";

export function SessionActions({ session }: { session: AuthSession | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const userName = session?.user.name || session?.user.email || "Usuario";

  async function logout() {
    const currentSession = session ?? readAuthSession();
    setPending(true);

    try {
      if (currentSession?.refreshToken) {
        await fetch(`${apiUrl}/api/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: currentSession.refreshToken }),
        });
      }
    } finally {
      clearAuthSession();
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-3 border-l border-slate-200 pl-3">
      <div className="hidden min-w-0 text-right sm:block">
        <p className="truncate text-sm font-semibold text-slate-900">{userName}</p>
        <p className="text-xs text-slate-500">Logado</p>
      </div>
      <button
        aria-label="Sair"
        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-950 disabled:opacity-60"
        disabled={pending}
        onClick={() => void logout()}
        title={pending ? "Saindo..." : "Sair"}
        type="button"
      >
        <LogOut aria-hidden className="h-4 w-4" />
        <span>Sair</span>
      </button>
    </div>
  );
}
