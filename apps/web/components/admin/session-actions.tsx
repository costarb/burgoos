"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clearAuthSession, readAuthSession } from "../../lib/auth-client";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";

export function SessionActions() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    const session = readAuthSession();
    setPending(true);

    try {
      if (session?.refreshToken) {
        await fetch(`${apiUrl}/api/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: session.refreshToken }),
        });
      }
    } finally {
      clearAuthSession();
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <button
      aria-label="Sair"
      className="inline-flex min-h-9 items-center justify-center rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      disabled={pending}
      onClick={() => void logout()}
      title="Sair"
      type="button"
    >
      <LogOut aria-hidden className="h-4 w-4" />
      <span className="ml-2 hidden sm:inline">{pending ? "Saindo..." : "Sair"}</span>
    </button>
  );
}
