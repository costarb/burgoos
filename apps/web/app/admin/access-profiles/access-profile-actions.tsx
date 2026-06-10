"use client";

import type { AccessProfileDetail, AccessStoreSummary } from "@burgoos/types";
import { Copy, Power } from "lucide-react";
import { useState } from "react";
import { duplicateAccessProfile, updateAccessProfile } from "../../../lib/api";

export function AccessProfileActions({
  token,
  profile,
  stores,
}: {
  token: string;
  profile: AccessProfileDetail;
  stores: AccessStoreSummary[];
}) {
  const [pending, setPending] = useState(false);
  const nextStatus = profile.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

  async function duplicate() {
    const name = window.prompt("Nome do novo perfil", `${profile.name} copia`);

    if (!name) {
      return;
    }

    setPending(true);
    try {
      await duplicateAccessProfile(token, profile.id, {
        name,
        storeId: profile.storeId ?? stores[0]?.id ?? null,
      });
      window.location.reload();
    } finally {
      setPending(false);
    }
  }

  async function toggleStatus() {
    const confirmed = window.confirm(
      nextStatus === "INACTIVE"
        ? `Desativar o perfil ${profile.name}?`
        : `Reativar o perfil ${profile.name}?`
    );

    if (!confirmed) {
      return;
    }

    setPending(true);
    try {
      await updateAccessProfile(token, profile.id, { status: nextStatus });
      window.location.reload();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
        disabled={pending}
        onClick={() => void duplicate()}
        type="button"
      >
        <Copy aria-hidden className="h-4 w-4" />
        Duplicar
      </button>
      <button
        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
        disabled={pending}
        onClick={() => void toggleStatus()}
        type="button"
      >
        <Power aria-hidden className="h-4 w-4" />
        {nextStatus === "INACTIVE" ? "Desativar" : "Reativar"}
      </button>
    </div>
  );
}
