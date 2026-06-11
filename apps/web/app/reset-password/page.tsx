"use client";

import { KeyRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { Suspense } from "react";
import { confirmPasswordReset } from "../../lib/api";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordShell />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState(searchParams.get("token") ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("As senhas nao conferem.");
      setPending(false);
      return;
    }

    try {
      await confirmPasswordReset(token, newPassword);
      setMessage("Senha definida com sucesso. Redirecionando para o login...");
      setTimeout(() => router.push("/login"), 900);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nao foi possivel definir a senha.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-slate-950 px-4 py-8 text-slate-950">
      <section className="mx-auto grid w-full max-w-md content-center">
        <div className="mb-8 text-white">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-tomato text-lg font-bold">
            B
          </div>
          <h1 className="mt-5 text-3xl font-semibold">Definir senha</h1>
          <p className="mt-2 text-sm text-slate-300">
            Informe o token recebido e escolha sua senha.
          </p>
        </div>

        <form className="rounded-md bg-white p-5 shadow-xl" onSubmit={submit}>
          <label className="block text-sm font-medium" htmlFor="token">
            Token de acesso
          </label>
          <input
            className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-700"
            id="token"
            name="token"
            onChange={(event) => setToken(event.target.value)}
            required
            value={token}
          />

          <label className="mt-4 block text-sm font-medium" htmlFor="newPassword">
            Nova senha
          </label>
          <input
            autoComplete="new-password"
            className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-700"
            id="newPassword"
            minLength={8}
            name="newPassword"
            onChange={(event) => setNewPassword(event.target.value)}
            required
            type="password"
            value={newPassword}
          />

          <label className="mt-4 block text-sm font-medium" htmlFor="confirmPassword">
            Confirmar senha
          </label>
          <input
            autoComplete="new-password"
            className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-700"
            id="confirmPassword"
            minLength={8}
            name="confirmPassword"
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            type="password"
            value={confirmPassword}
          />

          {error ? (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {message}
            </p>
          ) : null}

          <button
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pending}
            type="submit"
          >
            <KeyRound aria-hidden className="h-4 w-4" />
            {pending ? "Definindo..." : "Definir senha"}
          </button>
        </form>
      </section>
    </main>
  );
}

function ResetPasswordShell() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-4 py-8 text-sm font-medium text-white">
      Carregando acesso...
    </main>
  );
}
