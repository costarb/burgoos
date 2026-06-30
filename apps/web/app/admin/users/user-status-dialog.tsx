"use client";

import type { AccessUserDetail } from "@burgoos/types";
import { useState } from "react";
import { updateAccessUser } from "../../../lib/api";

export function UserStatusDialog({ token, user }: { token: string; user: AccessUserDetail }) {
  const [pending, setPending] = useState(false);
  const nextStatus = user.status === "ACTIVE" || user.status === "INVITED" ? "INACTIVE" : "ACTIVE";

  async function toggleStatus() {
    const confirmed = window.confirm(
      nextStatus === "INACTIVE"
        ? `Desativar o acesso de ${user.name}?`
        : `Reativar o acesso de ${user.name}?`
    );

    if (!confirmed) {
      return;
    }

    setPending(true);

    try {
      await updateAccessUser(token, user.id, { status: nextStatus });
      window.location.reload();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      className="min-h-10 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
      disabled={pending}
      onClick={() => void toggleStatus()}
      type="button"
    >
      {pending ? "Processando..." : nextStatus === "INACTIVE" ? "Desativar" : "Reativar"}
    </button>
  );
}
