"use client";

import React, { useEffect, useState } from "react";
import type { McpAuthorizationRequest } from "@rrfive/types";
import { AlertTriangle, Bot, Lock, PencilLine, ShieldCheck, Store } from "lucide-react";
import { refreshAuthSessionIfNeeded } from "../../../lib/auth-client";
import {
  approveMcpAuthorization,
  denyMcpAuthorization,
  getMcpAuthorizationRequest,
  McpConsentError,
} from "../../../lib/mcp-consent-api";

type ViewState =
  | { kind: "loading" }
  | { kind: "error"; title: string; message: string }
  | { kind: "ready"; request: McpAuthorizationRequest; accessToken: string }
  | { kind: "redirecting"; message: string };

const BLOCKED_MESSAGES: Record<
  NonNullable<McpAuthorizationRequest["blockedReason"]>,
  { title: string; message: string }
> = {
  MISSING_PERMISSION: {
    title: "Voce nao tem permissao para conectar assistentes",
    message:
      'Peca a um administrador da loja para incluir a permissao "Usar assistentes de IA" (MCP / IA) no seu perfil, em Acessos > Perfis.',
  },
  NO_ELIGIBLE_STORE: {
    title: "Nenhuma loja disponivel para conectar",
    message:
      "O MCP precisa estar habilitado na loja. Um administrador pode habilitar em Configuracoes > MCP / IA e depois voce tenta conectar de novo.",
  },
  PLATFORM_ADMIN: {
    title: "Conta de plataforma",
    message:
      "Contas de administracao da plataforma nao conectam assistentes as lojas. Entre com um usuario da loja.",
  },
};

export function McpConsentClient() {
  const [state, setState] = useState<ViewState>({ kind: "loading" });
  const [storeId, setStoreId] = useState<string | null>(null);
  const [allowActions, setAllowActions] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const requestId = new URLSearchParams(window.location.search).get("pedido");
    if (!requestId) {
      setState({
        kind: "error",
        title: "Pedido invalido",
        message: "Volte ao assistente e tente conectar novamente.",
      });
      return;
    }
    const session = await refreshAuthSessionIfNeeded();
    if (!session?.accessToken) {
      redirectToLogin();
      return;
    }
    try {
      const request = await getMcpAuthorizationRequest(session.accessToken, requestId);
      setStoreId(request.stores.length === 1 ? request.stores[0].id : null);
      setState({ kind: "ready", request, accessToken: session.accessToken });
    } catch (error) {
      if (error instanceof McpConsentError && error.status === 401) {
        redirectToLogin();
        return;
      }
      setState({
        kind: "error",
        title: "Pedido expirado ou invalido",
        message:
          error instanceof McpConsentError && error.status !== 410 && error.status !== 404
            ? error.message
            : "Este pedido de autorizacao expirou. Volte ao assistente e conecte novamente.",
      });
    }
  }

  async function decide(approve: boolean) {
    if (state.kind !== "ready" || busy) return;
    if (approve && !storeId) {
      setActionError("Escolha a loja que o assistente podera consultar.");
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const { redirectUrl } = approve
        ? await approveMcpAuthorization(
            state.accessToken,
            state.request.id,
            storeId!,
            allowActions &&
              (state.request.stores.find((store) => store.id === storeId)?.actions.length ?? 0) > 0
          )
        : await denyMcpAuthorization(state.accessToken, state.request.id);
      setState({
        kind: "redirecting",
        message: approve
          ? `Conectado. Voltando para ${state.request.client.name}...`
          : "Autorizacao cancelada. Voltando ao assistente...",
      });
      window.location.assign(redirectUrl);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Nao foi possivel concluir a autorizacao."
      );
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-slate-950 px-4 py-8 text-slate-900">
      <section className="mx-auto grid w-full max-w-lg content-center">
        <div className="mb-6 flex items-center gap-3 text-white">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-tomato font-display text-lg">
            5
          </div>
          <div>
            <p className="text-sm text-slate-300">RRFive OS</p>
            <h1 className="text-2xl font-semibold">Conectar assistente de IA</h1>
          </div>
        </div>

        <div className="rounded-md bg-white p-5 shadow-xl">
          {state.kind === "loading" ? (
            <p className="text-sm text-slate-600">Carregando pedido...</p>
          ) : null}

          {state.kind === "redirecting" ? (
            <p className="text-sm text-slate-700" role="status">
              {state.message}
            </p>
          ) : null}

          {state.kind === "error" ? (
            <div role="alert">
              <h2 className="text-lg font-semibold">{state.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{state.message}</p>
            </div>
          ) : null}

          {state.kind === "ready" ? (
            <ReadyView
              actionError={actionError}
              allowActions={allowActions}
              busy={busy}
              onAllowActions={setAllowActions}
              onDecide={decide}
              onSelectStore={setStoreId}
              request={state.request}
              storeId={storeId}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}

function ReadyView({
  request,
  storeId,
  busy,
  actionError,
  allowActions,
  onAllowActions,
  onSelectStore,
  onDecide,
}: {
  request: McpAuthorizationRequest;
  storeId: string | null;
  busy: boolean;
  actionError: string | null;
  allowActions: boolean;
  onAllowActions: (value: boolean) => void;
  onSelectStore: (id: string) => void;
  onDecide: (approve: boolean) => void;
}) {
  const blocked = request.blockedReason ? BLOCKED_MESSAGES[request.blockedReason] : null;
  const selected = request.stores.find((store) => store.id === storeId);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="rounded-md bg-slate-100 p-2">
          <Bot aria-hidden className="h-5 w-5" />
        </span>
        <div>
          <p className="text-lg font-semibold" data-testid="consent-client">
            {request.client.name} quer acessar os numeros da sua loja
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Depois de autorizar, voce volta para{" "}
            <strong data-testid="consent-host">{request.client.redirectHost}</strong>.
          </p>
        </div>
      </div>

      {request.client.loopbackOnly ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Este aplicativo roda no seu computador. Autorize somente se voce acabou de iniciar a
            conexao a partir dele (por exemplo, no Claude Code).
          </p>
        </div>
      ) : null}

      {blocked ? (
        <div role="alert">
          <h2 className="font-semibold">{blocked.title}</h2>
          <p className="mt-1 text-sm text-slate-600">{blocked.message}</p>
        </div>
      ) : (
        <>
          <fieldset>
            <legend className="flex items-center gap-2 text-sm font-semibold">
              <Store aria-hidden className="h-4 w-4" /> Loja
            </legend>
            <div className="mt-2 space-y-2">
              {request.stores.map((store) => (
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${
                    store.id === storeId ? "border-slate-900 bg-slate-50" : "border-slate-200"
                  }`}
                  key={store.id}
                >
                  <input
                    aria-label={`Loja ${store.name}`}
                    checked={store.id === storeId}
                    className="mt-1"
                    disabled={busy}
                    name="store"
                    onChange={() => onSelectStore(store.id)}
                    type="radio"
                  />
                  <span>
                    <span className="block font-medium">{store.name}</span>
                    <span className="block text-xs text-slate-500">
                      {store.areas.map((area) => area.label).join(", ")}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <ul className="space-y-1 text-sm text-slate-600">
            <li className="flex items-center gap-2">
              <Lock aria-hidden className="h-4 w-4" /> {request.scopeDescription}.{" "}
              {allowActions && selected?.actions.length
                ? "Acoes apenas as marcadas abaixo, com as suas permissoes."
                : "O assistente nao altera nada."}
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck aria-hidden className="h-4 w-4" /> Sem dados pessoais de clientes. Voce
              pode revogar em Configuracoes &gt; MCP / IA.
            </li>
            {selected?.actions.length ? (
              <li>
                <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950">
                  <input
                    aria-label="Permitir que o assistente execute acoes"
                    checked={allowActions}
                    className="mt-1"
                    disabled={busy}
                    onChange={(event) => onAllowActions(event.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    <span className="flex items-center gap-2 font-medium">
                      <PencilLine aria-hidden className="h-4 w-4" /> Permitir que o assistente
                      execute acoes
                    </span>
                    <span className="mt-1 block text-xs" data-testid="consent-actions">
                      Ele podera {selected.actions.map((action) => action.label).join("; ")}. Cada
                      acao fica registrada no seu nome e pode ser revogada a qualquer momento.
                    </span>
                  </span>
                </label>
              </li>
            ) : null}
            {selected ? (
              <li className="text-xs text-slate-500" data-testid="consent-areas">
                Areas visiveis: {selected.areas.map((area) => area.label).join(", ")}
              </li>
            ) : null}
          </ul>
        </>
      )}

      {actionError ? (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {actionError}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <button
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
          disabled={busy}
          onClick={() => onDecide(false)}
          type="button"
        >
          Cancelar
        </button>
        {blocked ? null : (
          <button
            className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={busy || !storeId}
            onClick={() => onDecide(true)}
            type="button"
          >
            Autorizar
          </button>
        )}
      </div>
    </div>
  );
}

function redirectToLogin() {
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/login?next=${encodeURIComponent(next)}`);
}
