"use client";

import React, { FormEvent, useState } from "react";
import {
  MercadoPagoPlatformConfigurationView,
  PagBankPlatformConfigurationView,
  updateMercadoPagoPlatformConfiguration,
  updatePagBankPlatformConfiguration,
} from "../../../lib/api";

export function PlatformIntegrationsClient({
  token,
  mercadoPago,
  pagBank,
}: {
  token: string;
  mercadoPago: MercadoPagoPlatformConfigurationView;
  pagBank: PagBankPlatformConfigurationView;
}) {
  const [tab, setTab] = useState<"PAGBANK" | "MERCADO_PAGO">("PAGBANK");
  return (
    <main className="mx-auto grid w-full max-w-4xl gap-6 p-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-tomato">Plataforma</p>
        <h1 className="mt-1 text-3xl font-semibold">IntegraÃ§Ãµes</h1>
        <p className="mt-2 text-slate-600">
          ConfiguraÃ§Ãµes globais da aplicaÃ§Ã£o. Administradores das lojas nÃ£o visualizam estes
          dados.
        </p>
      </header>
      <nav className="flex gap-2 border-b" aria-label="Integrações de vendas">
        {(["PAGBANK", "MERCADO_PAGO"] as const).map((provider) => (
          <button
            key={provider}
            type="button"
            onClick={() => setTab(provider)}
            className={`border-b-2 px-4 py-2 font-semibold ${
              tab === provider ? "border-tomato text-tomato" : "border-transparent text-slate-600"
            }`}
          >
            {provider === "PAGBANK" ? "PagBank" : "Mercado Pago"}
          </button>
        ))}
      </nav>
      {tab === "PAGBANK" ? (
        <PagBankConfigurationForm token={token} initialValue={pagBank} />
      ) : (
        <MercadoPagoPlatformConfigurationClient token={token} initialValue={mercadoPago} embedded />
      )}
    </main>
  );
}

export function MercadoPagoPlatformConfigurationClient({
  token,
  initialValue,
  embedded = false,
}: {
  token: string;
  initialValue: MercadoPagoPlatformConfigurationView;
  embedded?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = Object.fromEntries(
      ["apiBaseUrl", "clientId", "clientSecret", "webhookSecret", "redirectUri", "postCallbackUrl"]
        .map((key) => [key, String(data.get(key) ?? "").trim()] as const)
        .filter(([, item]) => item.length > 0)
    );
    try {
      setValue(await updateMercadoPagoPlatformConfiguration(token, payload));
      form.reset();
      setMessage("Configuração Mercado Pago atualizada sem reiniciar a aplicação.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao atualizar configuração");
    } finally {
      setBusy(false);
    }
  }

  const content = (
    <>
      {!embedded ? (
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-tomato">Plataforma</p>
          <h1 className="mt-1 text-3xl font-semibold">Integrações</h1>
          <p className="mt-2 text-slate-600">
            Credenciais globais da aplicação RRF5 OS. Administradores das lojas não visualizam estes
            dados.
          </p>
        </header>
      ) : null}
      <section className="grid gap-4 rounded border bg-white p-5">
        <div>
          <h2 className="text-xl font-semibold">Mercado Pago</h2>
          <p className="text-sm text-slate-600">
            OAuth: {value.oauthReady ? "configurado" : "incompleto"} · Webhook:{" "}
            {value.webhookReady ? "configurado" : "incompleto"} · Origem atual:{" "}
            {value.source === "DATABASE" ? "banco de dados" : "variáveis de ambiente"}
          </p>
        </div>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <Field name="apiBaseUrl" label="URL da API de consulta" value={value.apiBaseUrl} />
          <Field name="clientId" label="Client ID" configured={value.clientIdConfigured} />
          <SecretField
            name="clientSecret"
            label="Client Secret"
            configured={value.clientSecretConfigured}
          />
          <SecretField
            name="webhookSecret"
            label="Webhook Secret"
            configured={value.webhookSecretConfigured}
          />
          <Field name="redirectUri" label="Callback OAuth" value={value.redirectUri ?? ""} />
          <Field
            name="postCallbackUrl"
            label="Retorno após conexão"
            value={value.postCallbackUrl ?? ""}
          />
          <div className="flex items-end">
            <button
              disabled={busy}
              className="rounded bg-ink px-4 py-2 font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Salvando..." : "Salvar configuração"}
            </button>
          </div>
        </form>
        <p role="status" className="text-sm font-medium text-slate-700">
          {message}
        </p>
      </section>
    </>
  );
  return embedded ? (
    content
  ) : (
    <main className="mx-auto grid w-full max-w-4xl gap-6 p-6">{content}</main>
  );
}

function PagBankConfigurationForm({
  token,
  initialValue,
}: {
  token: string;
  initialValue: PagBankPlatformConfigurationView;
}) {
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const apiBaseUrl = String(new FormData(event.currentTarget).get("apiBaseUrl") ?? "").trim();
    try {
      setValue(await updatePagBankPlatformConfiguration(token, { apiBaseUrl }));
      setMessage("ConfiguraÃ§Ã£o PagBank atualizada sem reiniciar a aplicaÃ§Ã£o.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao atualizar configuraÃ§Ã£o");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="grid gap-4 rounded border bg-white p-5">
      <div>
        <h2 className="text-xl font-semibold">PagBank</h2>
        <p className="text-sm text-slate-600">
          Origem atual: {value.source === "DATABASE" ? "banco de dados" : "configuraÃ§Ã£o padrÃ£o"}.
          Consultas permitem D+0. Caso o EDI ainda não tenha disponibilizado o dia, a falha será
          registrada para nova tentativa.
        </p>
      </div>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        <Field name="apiBaseUrl" label="URL da API de consulta" value={value.apiBaseUrl} />
        <div className="flex items-end">
          <button disabled={busy} className="rounded bg-ink px-4 py-2 font-semibold text-white">
            {busy ? "Salvando..." : "Salvar configuraÃ§Ã£o"}
          </button>
        </div>
      </form>
      <p role="status" className="text-sm font-medium text-slate-700">
        {message}
      </p>
    </section>
  );
}

function Field({
  name,
  label,
  value,
  configured,
}: {
  name: string;
  label: string;
  value?: string;
  configured?: boolean;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold">
      {label}{" "}
      {configured ? <span className="font-normal text-emerald-700">(configurado)</span> : null}
      <input name={name} defaultValue={value} className="rounded border px-3 py-2 font-normal" />
    </label>
  );
}

function SecretField({
  name,
  label,
  configured,
}: {
  name: string;
  label: string;
  configured: boolean;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold">
      {label}{" "}
      <span className="font-normal text-slate-500">
        {configured ? "configurado · informe apenas para substituir" : "não configurado"}
      </span>
      <input
        name={name}
        type="password"
        autoComplete="new-password"
        className="rounded border px-3 py-2 font-normal"
      />
    </label>
  );
}
