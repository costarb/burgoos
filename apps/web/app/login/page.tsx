"use client";

import type { AuthSession } from "@burgoos/types";
import { LogIn } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { writeAuthSession } from "../../lib/auth-client";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const session = await authenticate(email, password);
      const targetPath = isPlatformAdminSession(session) ? "/platform/stores" : "/admin";

      writeAuthSession(session);
      window.location.assign(targetPath);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nao foi possivel entrar.");
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
          <h1 className="mt-5 text-3xl font-semibold">BurgoOS</h1>
          <p className="mt-2 text-sm text-slate-300">Acesse a administracao da loja.</p>
        </div>

        <form className="rounded-md bg-white p-5 shadow-xl" onSubmit={submit}>
          <label className="block text-sm font-medium" htmlFor="email">
            Email
          </label>
          <input
            autoComplete="email"
            className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-700"
            id="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />

          <label className="mt-4 block text-sm font-medium" htmlFor="password">
            Senha
          </label>
          <input
            autoComplete="current-password"
            className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-700"
            id="password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />

          {error ? (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}

          <button
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pending}
            type="submit"
          >
            <LogIn aria-hidden className="h-4 w-4" />
            {pending ? "Entrando..." : "Entrar"}
          </button>
          <Link
            className="mt-4 block text-center text-sm font-medium text-slate-600 hover:text-slate-950"
            href="/reset-password"
          >
            Definir senha ou recuperar acesso
          </Link>
        </form>
      </section>
    </main>
  );
}

async function authenticate(email: string, password: string): Promise<AuthSession> {
  const adminResponse = await postLogin("/api/auth/login", email, password);

  if (adminResponse.ok) {
    return adminResponse.json() as Promise<AuthSession>;
  }

  const platformResponse = await postLogin("/api/auth/platform/login", email, password);

  if (platformResponse.ok) {
    return platformResponse.json() as Promise<AuthSession>;
  }

  throw new Error("Credenciais invalidas ou usuario sem acesso ativo.");
}

function postLogin(path: string, email: string, password: string): Promise<Response> {
  return fetch(`${apiUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

function isPlatformAdminSession(session: AuthSession): boolean {
  return Boolean((session.user as { isPlatformAdmin?: boolean }).isPlatformAdmin);
}
