"use client";

import type { AccessUserDetail } from "@burgoos/types";
import { KeyRound } from "lucide-react";
import { useState } from "react";
import { issueFirstAccessLink } from "../../../lib/api";

interface FirstAccessActionProps {
  token: string;
  user: AccessUserDetail;
}

export function FirstAccessAction({ token, user }: FirstAccessActionProps) {
  const [pending, setPending] = useState(false);
  const [setupUrl, setSetupUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function issueLink() {
    setPending(true);
    setMessage(null);

    try {
      const issued = await issueFirstAccessLink(token, user.id);
      setSetupUrl(issued.setupUrl);
      setMessage(`Link valido ate ${new Date(issued.expiresAt).toLocaleString("pt-BR")}.`);
      await navigator.clipboard?.writeText(issued.setupUrl).catch(() => undefined);
    } catch (error) {
      setSetupUrl(null);
      setMessage(error instanceof Error ? error.message : "Nao foi possivel gerar o acesso.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button
        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        disabled={pending}
        onClick={() => void issueLink()}
        type="button"
      >
        <KeyRound aria-hidden className="h-4 w-4" />
        {pending
          ? "Gerando..."
          : user.status === "INVITED"
            ? "Gerar primeiro acesso"
            : "Redefinir senha"}
      </button>
      {setupUrl ? (
        <input
          className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
          onFocus={(event) => event.currentTarget.select()}
          readOnly
          value={setupUrl}
        />
      ) : null}
      {message ? <p className="text-xs text-slate-500">{message}</p> : null}
    </div>
  );
}
