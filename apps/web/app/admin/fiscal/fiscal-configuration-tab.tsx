"use client";

import React, { useEffect, useState } from "react";
import type {
  BlingConnectionOptions,
  BlingSettingsPayload,
  FiscalConfigurationPayload,
  FiscalConfigurationView,
  FiscalIssuerPayload,
} from "@rrfive/types";
import { CheckCircle2, CircleAlert, Link2, PlugZap, Unplug } from "lucide-react";
import { READINESS_LABEL, type FiscalActionState } from "./fiscal-labels";

export interface FiscalConfigurationActions {
  saveConfiguration: (payload: FiscalConfigurationPayload) => Promise<FiscalActionState<FiscalConfigurationView>>;
  saveIssuer: (payload: FiscalIssuerPayload) => Promise<FiscalActionState<FiscalConfigurationView>>;
  startBlingAuthorization: () => Promise<FiscalActionState<{ authorizationUrl: string; expiresAt: string }>>;
  loadBlingOptions: () => Promise<FiscalActionState<BlingConnectionOptions>>;
  saveBlingSettings: (payload: BlingSettingsPayload) => Promise<FiscalActionState<BlingSettingsPayload>>;
  disconnectBling: () => Promise<FiscalActionState<void>>;
  refreshConfiguration: () => Promise<FiscalActionState<FiscalConfigurationView>>;
}

interface Props {
  configuration: FiscalConfigurationView;
  actions: FiscalConfigurationActions;
  busy: boolean;
  run: <T>(action: () => Promise<FiscalActionState<T>>, onSuccess?: (data: T) => void) => Promise<void>;
  onConfiguration: (configuration: FiscalConfigurationView) => void;
}

const ADDRESS_FIELDS: Array<[keyof FiscalConfigurationView["address"], string]> = [
  ["street", "Logradouro"],
  ["number", "Numero"],
  ["complement", "Complemento"],
  ["neighborhood", "Bairro"],
  ["city", "Cidade"],
  ["state", "UF"],
  ["postalCode", "CEP"],
];

const inputClass = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";
const labelClass = "block text-sm font-medium text-slate-700";
const cardClass = "rounded-md border border-slate-200 bg-white p-5 shadow-sm";

export function FiscalConfigurationTab({ configuration, actions, busy, run, onConfiguration }: Props) {
  const [issuer, setIssuer] = useState<FiscalIssuerPayload>(() => issuerForm(configuration));
  const [settings, setSettings] = useState<FiscalConfigurationPayload>(() => settingsForm(configuration));
  const [options, setOptions] = useState<BlingConnectionOptions | null>(null);
  const [bling, setBling] = useState<BlingSettingsPayload>({ naturezaOperacaoId: "", paymentMethodMap: {} });

  useEffect(() => {
    setIssuer(issuerForm(configuration));
    setSettings(settingsForm(configuration));
  }, [configuration]);

  const connected = configuration.connection?.status === "CONNECTED";
  const blockingPending = configuration.readiness.items.filter((item) => item.blocking && !item.ok);

  function loadOptions() {
    return run(actions.loadBlingOptions, (data) => {
      setOptions(data);
      setBling({
        naturezaOperacaoId: data.current.naturezaOperacaoId ?? data.suggested.naturezaOperacaoId ?? "",
        paymentMethodMap: { ...data.suggested.paymentMethodMap, ...data.current.paymentMethodMap },
      });
    });
  }

  function connectBling() {
    return run(actions.startBlingAuthorization, (data) => {
      window.location.assign(data.authorizationUrl);
    });
  }

  return (
    <div className="space-y-6">
      <section className={cardClass} data-testid="fiscal-readiness">
        <h2 className="text-lg font-semibold">Prontidao para emitir</h2>
        <p className="mt-1 text-sm text-slate-600">
          {configuration.readiness.ready
            ? "Tudo pronto. Ative a emissao quando quiser comecar."
            : `Faltam ${blockingPending.length} item(ns) obrigatorio(s) para ativar a emissao.`}
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {configuration.readiness.items.map((item) => (
            <li className="flex items-start gap-2 text-sm" key={item.key}>
              {item.ok ? (
                <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <CircleAlert aria-hidden className={`mt-0.5 h-4 w-4 shrink-0 ${item.blocking ? "text-red-600" : "text-amber-500"}`} />
              )}
              <span>
                <strong className="font-semibold">{READINESS_LABEL[item.key]}:</strong> {item.message}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={cardClass}>
        <h2 className="text-lg font-semibold">Emitente</h2>
        <p className="mt-1 text-sm text-slate-600">O endereco vem do cadastro da loja. Os dados abaixo completam a identificacao fiscal.</p>
        <dl className="mt-3 grid gap-2 rounded-md bg-slate-50 p-3 text-sm sm:grid-cols-3" data-testid="fiscal-address">
          {ADDRESS_FIELDS.map(([field, label]) => (
            <div key={field}>
              <dt className="text-xs uppercase text-slate-500">{label}</dt>
              <dd className={configuration.missingAddressFields.includes(field) ? "font-semibold text-red-700" : ""}>
                {configuration.address[field] ?? (configuration.missingAddressFields.includes(field) ? "Obrigatorio" : "-")}
              </dd>
            </div>
          ))}
        </dl>
        {configuration.missingAddressFields.length ? (
          <p className="mt-2 text-sm text-red-700">
            Complete o endereco na tela de cadastro da loja antes de emitir.
          </p>
        ) : null}
        <form
          className="mt-4 grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            void run(() => actions.saveIssuer(issuer), onConfiguration);
          }}
        >
          <label className={labelClass}>
            Razao social
            <input className={inputClass} onChange={(event) => setIssuer({ ...issuer, legalName: event.target.value })} required value={issuer.legalName} />
          </label>
          <label className={labelClass}>
            Nome fantasia
            <input className={inputClass} onChange={(event) => setIssuer({ ...issuer, tradeName: event.target.value })} value={issuer.tradeName ?? ""} />
          </label>
          <label className={labelClass}>
            CNPJ
            <input className={inputClass} onChange={(event) => setIssuer({ ...issuer, cnpj: event.target.value })} required value={issuer.cnpj} />
          </label>
          <label className={labelClass}>
            Inscricao estadual
            <input className={inputClass} onChange={(event) => setIssuer({ ...issuer, stateRegistration: event.target.value })} required value={issuer.stateRegistration} />
          </label>
          <label className={labelClass}>
            Regime tributario
            <select className={inputClass} disabled value="SIMPLES_NACIONAL">
              <option value="SIMPLES_NACIONAL">Simples Nacional / MEI</option>
            </select>
          </label>
          <label className={labelClass}>
            Codigo IBGE do municipio
            <input
              className={inputClass}
              onChange={(event) => setIssuer({ ...issuer, municipalityIbgeCode: event.target.value || null })}
              placeholder="Automatico pela cidade"
              value={issuer.municipalityIbgeCode ?? ""}
            />
          </label>
          <div className="sm:col-span-2">
            <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} type="submit">
              Salvar emitente
            </button>
          </div>
        </form>
      </section>

      <section className={cardClass}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Provedor de emissao</h2>
            <p className="mt-1 text-sm text-slate-600">
              A NFC-e e emitida pela conta Bling da empresa. O cancelamento da nota e feito no painel do Bling (o sistema avisa e acompanha).
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${connected ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}
            data-testid="fiscal-connection-status"
          >
            {connected ? "Bling conectado" : configuration.connection?.status === "ERROR" ? "Erro na conexao" : "Nao conectado"}
          </span>
        </div>
        {configuration.connection?.lastErrorMessage ? (
          <p className="mt-2 text-sm text-red-700">{configuration.connection.lastErrorMessage}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="inline-flex items-center gap-2 rounded-md bg-tomato px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} onClick={() => void connectBling()} type="button">
            <PlugZap aria-hidden className="h-4 w-4" /> {connected ? "Reconectar Bling" : "Conectar Bling"}
          </button>
          {connected ? (
            <>
              <button className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-60" disabled={busy} onClick={() => void loadOptions()} type="button">
                <Link2 aria-hidden className="h-4 w-4" /> Configurar natureza e pagamentos
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                disabled={busy}
                onClick={() => void run(actions.disconnectBling, () => void run(actions.refreshConfiguration, onConfiguration))}
                type="button"
              >
                <Unplug aria-hidden className="h-4 w-4" /> Desconectar
              </button>
            </>
          ) : null}
        </div>

        {options ? (
          <form
            className="mt-5 space-y-4 border-t border-slate-200 pt-4"
            data-testid="bling-settings"
            onSubmit={(event) => {
              event.preventDefault();
              void run(() => actions.saveBlingSettings(bling), () => void run(actions.refreshConfiguration, onConfiguration));
            }}
          >
            {options.account?.cnpj && configuration.issuer && options.account.cnpj !== configuration.issuer.cnpj ? (
              <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                O CNPJ da conta Bling ({options.account.cnpj}) e diferente do CNPJ do emitente.
              </p>
            ) : null}
            <label className={labelClass}>
              Natureza de operacao das NFC-e
              <select className={inputClass} onChange={(event) => setBling({ ...bling, naturezaOperacaoId: event.target.value })} required value={bling.naturezaOperacaoId}>
                <option value="">Selecione</option>
                {options.operationNatures.map((nature) => (
                  <option key={nature.id} value={nature.id}>
                    {nature.name}
                    {nature.defaultForSales ? " (padrao de venda)" : ""}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs font-normal text-slate-500">
                No Bling, a natureza precisa estar: Saida, Faturada, Consumidor final, Indicador de presenca 1 e com o regime atual do CNPJ.
              </span>
            </label>
            <fieldset>
              <legend className={labelClass}>Formas de pagamento</legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {options.paymentMethods.map((method) => (
                  <label className="text-sm" key={method.method}>
                    {method.label} <span className="text-xs text-slate-500">(codigo {method.tPag})</span>
                    <select
                      aria-label={`Forma do Bling para ${method.label}`}
                      className={inputClass}
                      onChange={(event) => setBling({ ...bling, paymentMethodMap: { ...bling.paymentMethodMap, [method.method]: event.target.value } })}
                      value={bling.paymentMethodMap[method.method] ?? ""}
                    >
                      <option value="">Nao vinculada</option>
                      {options.paymentForms.map((form) => (
                        <option key={form.id} value={form.id}>
                          {form.name} (codigo {form.tPag})
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </fieldset>
            <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} type="submit">
              Salvar configuracao do Bling
            </button>
          </form>
        ) : null}
      </section>

      <section className={cardClass}>
        <h2 className="text-lg font-semibold">Emissao</h2>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            void run(() => actions.saveConfiguration(settings), onConfiguration);
          }}
        >
          <label className={labelClass}>
            Ambiente
            <select className={inputClass} onChange={(event) => setSettings({ ...settings, environment: event.target.value as FiscalConfigurationPayload["environment"] })} value={settings.environment}>
              <option value="HOMOLOGATION">Homologacao (testes, sem valor fiscal)</option>
              <option value="PRODUCTION">Producao</option>
            </select>
          </label>
          <label className={labelClass}>
            Modo de emissao
            <select className={inputClass} onChange={(event) => setSettings({ ...settings, emissionMode: event.target.value as FiscalConfigurationPayload["emissionMode"] })} value={settings.emissionMode}>
              <option value="AUTOMATIC">Automatico (vendas pagas do dia)</option>
              <option value="MANUAL">Manual (botao no pedido)</option>
            </select>
          </label>
          <label className={labelClass}>
            Serie
            <input
              className={inputClass}
              min={1}
              onChange={(event) => setSettings({ ...settings, series: event.target.value ? Number(event.target.value) : null })}
              type="number"
              value={settings.series ?? ""}
            />
          </label>
          <label className={labelClass}>
            Justificativa padrao de cancelamento
            <input className={inputClass} minLength={15} onChange={(event) => setSettings({ ...settings, defaultCancelReason: event.target.value })} value={settings.defaultCancelReason} />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
            <input
              checked={settings.enabled}
              disabled={!settings.enabled && !configuration.readiness.ready}
              onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })}
              type="checkbox"
            />
            Emissao de NFC-e ativa
            {!configuration.readiness.ready && !settings.enabled ? (
              <span className="text-xs font-normal text-slate-500">(conclua a prontidao para ativar)</span>
            ) : null}
          </label>
          <div className="sm:col-span-2">
            <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} type="submit">
              Salvar emissao
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function issuerForm(configuration: FiscalConfigurationView): FiscalIssuerPayload {
  return {
    legalName: configuration.issuer?.legalName ?? "",
    tradeName: configuration.issuer?.tradeName ?? "",
    cnpj: configuration.issuer?.cnpj ?? "",
    stateRegistration: configuration.issuer?.stateRegistration ?? "",
    taxRegime: "SIMPLES_NACIONAL",
    municipalityIbgeCode: configuration.issuer?.municipalityIbgeSource === "MANUAL" ? configuration.issuer.municipalityIbgeCode : null,
  };
}

function settingsForm(configuration: FiscalConfigurationView): FiscalConfigurationPayload {
  return {
    enabled: configuration.enabled,
    provider: configuration.provider ?? "BLING",
    environment: configuration.environment,
    series: configuration.series,
    emissionMode: configuration.emissionMode,
    defaultCancelReason: configuration.defaultCancelReason,
  };
}
