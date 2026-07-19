"use client";

import React, { FormEvent, useState } from "react";
import {
  MercadoPagoPlatformConfigurationView,
  updateMercadoPagoPlatformConfiguration,
} from "../../../lib/api";

export function MercadoPagoPlatformConfigurationClient({
  token,
  initialValue,
}: {
  token: string;
  initialValue: MercadoPagoPlatformConfigurationView;
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
      ["clientId", "clientSecret", "webhookSecret", "redirectUri", "postCallbackUrl"]
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

  return (
    <main className="mx-auto grid w-full max-w-4xl gap-6 p-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-tomato">Plataforma</p>
        <h1 className="mt-1 text-3xl font-semibold">Integrações</h1>
        <p className="mt-2 text-slate-600">
          Credenciais globais da aplicação RRF5 OS. Administradores das lojas não visualizam estes
          dados.
        </p>
      </header>
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
    </main>
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
