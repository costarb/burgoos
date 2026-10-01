"use client";

import React, { useEffect, useState } from "react";
import type {
  CreateMcpTokenPayload,
  CreatedMcpToken,
  McpConfiguration,
  McpConfigurationPayload,
  McpDataArea,
  McpToken,
  McpTokenExpiration,
  OperationState,
} from "@rrfive/types";
import { Bot, KeyRound } from "lucide-react";
import { ConfirmationDialog } from "../../../../components/admin/confirmation-dialog";
import { OperationFeedback } from "../../../../components/admin/operation-feedback";
import { idleOperationState } from "../../../../lib/operation-state";
import type { McpActionState } from "./mcp-action-state";
import { McpTokenCreatedDialog } from "./mcp-token-created-dialog";

interface McpSettingsClientProps {
  configuration: McpConfiguration;
  tokens: McpToken[];
  saveConfigurationAction: (
    payload: McpConfigurationPayload
  ) => Promise<McpActionState<McpConfiguration>>;
  createTokenAction: (payload: CreateMcpTokenPayload) => Promise<McpActionState<CreatedMcpToken>>;
  revokeTokenAction: (id: string) => Promise<McpActionState<McpToken>>;
}

const EXPIRATION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "365", label: "1 ano" },
  { value: "never", label: "Sem expiracao" },
];

const STATUS_LABEL: Record<McpToken["status"], { label: string; classes: string }> = {
  ACTIVE: { label: "Ativo", classes: "bg-emerald-100 text-emerald-800" },
  EXPIRED: { label: "Expirado", classes: "bg-amber-100 text-amber-800" },
  REVOKED: { label: "Revogado", classes: "bg-slate-200 text-slate-700" },
};

export function McpSettingsClient({
  configuration: initialConfiguration,
  tokens: initialTokens,
  saveConfigurationAction,
  createTokenAction,
  revokeTokenAction,
}: McpSettingsClientProps) {
  const [configuration, setConfiguration] = useState(initialConfiguration);
  const [tokens, setTokens] = useState(initialTokens);
  const [feedback, setFeedback] = useState<OperationState>(idleOperationState);
  const [busy, setBusy] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [expiration, setExpiration] = useState("90");
  const [created, setCreated] = useState<CreatedMcpToken | null>(null);
  const [revoking, setRevoking] = useState<McpToken | null>(null);

  useEffect(() => setConfiguration(initialConfiguration), [initialConfiguration]);
  useEffect(() => setTokens(initialTokens), [initialTokens]);

  const activeTokens = tokens.filter((token) => token.status === "ACTIVE").length;

  async function run<T>(
    action: () => Promise<McpActionState<T>>,
    onSuccess: (data: T) => void
  ): Promise<void> {
    if (busy) return;
    setBusy(true);
    setFeedback({ status: "pending", message: "Processando solicitacao." });
    try {
      const result = await action();
      setFeedback({ status: result.status, message: result.message });
      if (result.status === "success" && result.data !== undefined) onSuccess(result.data);
    } catch (error) {
      setFeedback({
        status: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel concluir a operacao.",
      });
    } finally {
      setBusy(false);
    }
  }

  function saveConfiguration(payload: McpConfigurationPayload) {
    return run(() => saveConfigurationAction(payload), setConfiguration);
  }

  function toggleArea(area: McpDataArea) {
    const enabled = configuration.enabledAreas.includes(area);
    if (enabled && configuration.enabled && configuration.enabledAreas.length === 1) {
      setFeedback({
        status: "error",
        message: "Mantenha ao menos uma area de dados ativa enquanto o MCP estiver habilitado.",
      });
      return;
    }
    const enabledAreas = enabled
      ? configuration.enabledAreas.filter((item) => item !== area)
      : [...configuration.enabledAreas, area];
    return saveConfiguration({ enabled: configuration.enabled, enabledAreas });
  }

  function createToken() {
    const name = tokenName.trim();
    if (!name) {
      setFeedback({ status: "error", message: "Informe um nome para identificar o token." });
      return;
    }
    const expiresInDays = (
      expiration === "never" ? null : Number(expiration)
    ) as McpTokenExpiration;
    return run(
      () => createTokenAction({ name, expiresInDays }),
      (data) => {
        setCreated(data);
        setTokenName("");
        const { token: _secret, snippets: _snippets, ...view } = data;
        setTokens((current) => [view, ...current.filter((item) => item.id !== view.id)]);
      }
    );
  }

  function confirmRevoke() {
    if (!revoking) return;
    const target = revoking;
    return run(
      () => revokeTokenAction(target.id),
      (data) => {
        setTokens((current) => current.map((item) => (item.id === data.id ? data : item)));
        setRevoking(null);
      }
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <section className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-tomato">Configuracoes</p>
            <h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold">
              <Bot aria-hidden className="h-7 w-7" /> MCP / IA
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Conecte assistentes de IA (Claude, Cursor e outros clientes MCP) aos numeros desta
              loja para gerar analises e insights. O acesso e somente leitura, por token, e nunca
              inclui dados pessoais de clientes.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold ${
                configuration.enabled
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-200 text-slate-700"
              }`}
              data-testid="mcp-status"
            >
              {configuration.enabled ? "Habilitado" : "Desabilitado"}
            </span>
            <button
              className={`rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                configuration.enabled ? "bg-slate-700 hover:bg-slate-800" : "bg-tomato hover:opacity-90"
              }`}
              disabled={busy}
              onClick={() =>
                saveConfiguration({
                  enabled: !configuration.enabled,
                  enabledAreas: configuration.enabledAreas.length
                    ? configuration.enabledAreas
                    : configuration.availableAreas.map((item) => item.area),
                })
              }
              type="button"
            >
              {configuration.enabled ? "Desabilitar" : "Habilitar"}
            </button>
          </div>
        </header>

        <OperationFeedback
          onDismiss={() => setFeedback(idleOperationState)}
          state={feedback}
        />

        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Areas de dados</h2>
          <p className="mt-1 text-sm text-slate-600">
            Escolha o que o assistente pode consultar. Mudancas valem na proxima chamada do
            cliente.
          </p>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {configuration.availableAreas.map((area) => {
              const checked = configuration.enabledAreas.includes(area.area);
              return (
                <li
                  className="flex items-start justify-between gap-3 rounded-md border border-slate-200 p-3"
                  key={area.area}
                >
                  <div className="min-w-0">
                    <p className="font-semibold">{area.label}</p>
                    <p className="text-sm text-slate-600">{area.description}</p>
                    <p className="mt-1 text-xs text-slate-500">{area.tools.join(", ")}</p>
                  </div>
                  <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 text-sm">
                    <input
                      aria-label={`Area ${area.label}`}
                      checked={checked}
                      className="h-4 w-4"
                      disabled={busy}
                      onChange={() => toggleArea(area.area)}
                      type="checkbox"
                    />
                    {checked ? "Ativa" : "Inativa"}
                  </label>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <KeyRound aria-hidden className="h-5 w-5" /> Tokens de acesso
            </h2>
            <span className="text-sm text-slate-500">{activeTokens} de 10 ativos</span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Cada token da acesso somente a esta loja. Endereco do servidor:{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
              {configuration.serverUrl}
            </code>
          </p>

          <form
            className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              void createToken();
            }}
          >
            <input
              aria-label="Nome do token"
              className="rounded-md border border-slate-200 px-3 py-2 text-sm"
              disabled={!configuration.enabled || busy}
              maxLength={80}
              onChange={(event) => setTokenName(event.target.value)}
              placeholder="Ex.: Notebook do gerente"
              value={tokenName}
            />
            <select
              aria-label="Validade"
              className="rounded-md border border-slate-200 px-3 py-2 text-sm"
              disabled={!configuration.enabled || busy}
              onChange={(event) => setExpiration(event.target.value)}
              value={expiration}
            >
              {EXPIRATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              disabled={!configuration.enabled || busy}
              type="submit"
            >
              Gerar token
            </button>
          </form>
          {!configuration.enabled ? (
            <p className="mt-2 text-sm text-slate-500">Habilite o MCP para gerar tokens.</p>
          ) : null}

          {tokens.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">Nenhum token gerado.</p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Nome</th>
                    <th className="py-2 pr-4">Token</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Validade</th>
                    <th className="py-2 pr-4">Ultimo uso</th>
                    <th className="py-2 pr-4">Gerado por</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((token) => (
                    <tr className="border-b border-slate-100" key={token.id}>
                      <td className="py-2 pr-4 font-medium">{token.name}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{token.tokenPrefix}…</td>
                      <td className="py-2 pr-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_LABEL[token.status].classes}`}
                        >
                          {STATUS_LABEL[token.status].label}
                        </span>
                      </td>
                      <td className="py-2 pr-4">{formatDate(token.expiresAt) ?? "Sem expiracao"}</td>
                      <td className="py-2 pr-4">{formatDateTime(token.lastUsedAt) ?? "Nunca"}</td>
                      <td className="py-2 pr-4">{token.createdBy ?? "-"}</td>
                      <td className="py-2 text-right">
                        {token.status !== "REVOKED" ? (
                          <button
                            className="rounded-md border border-red-200 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                            disabled={busy}
                            onClick={() => setRevoking(token)}
                            type="button"
                          >
                            Revogar
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>

      {created ? (
        <McpTokenCreatedDialog created={created} onClose={() => setCreated(null)} />
      ) : null}

      <ConfirmationDialog
        busy={busy}
        confirmLabel="Revogar token"
        description={
          revoking
            ? `O token "${revoking.name}" deixara de funcionar imediatamente em todos os clientes configurados com ele.`
            : ""
        }
        onCancel={() => setRevoking(null)}
        onConfirm={() => void confirmRevoke()}
        open={revoking !== null}
        title="Revogar token?"
      />
    </main>
  );
}

function formatDate(value: string | null): string | null {
  return value ? new Date(value).toLocaleDateString("pt-BR") : null;
}

function formatDateTime(value: string | null): string | null {
  return value
    ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : null;
}
