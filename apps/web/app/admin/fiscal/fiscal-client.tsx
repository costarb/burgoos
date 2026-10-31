"use client";

import React, { useEffect, useState } from "react";
import type {
  FiscalConfigurationView,
  FiscalDocumentPage,
  FiscalMissingProfiles,
  FiscalProfileAssignments,
  FiscalProfileView,
  FiscalUnissuedSale,
  OperationState,
} from "@rrfive/types";
import { ReceiptText } from "lucide-react";
import { OperationFeedback } from "../../../components/admin/operation-feedback";
import { readAuthSession } from "../../../lib/auth-client";
import { idleOperationState } from "../../../lib/operation-state";
import { FiscalConfigurationTab, type FiscalConfigurationActions } from "./fiscal-configuration-tab";
import { FiscalDocumentsTab, type FiscalDocumentActions } from "./fiscal-documents-tab";
import type { FiscalActionState } from "./fiscal-labels";
import { FiscalProfilesTab, type FiscalProfileActions } from "./fiscal-profiles-tab";
import { FiscalUnissuedTab, type FiscalUnissuedActions } from "./fiscal-unissued-tab";

export type FiscalTab = "configuracao" | "perfis" | "vendas" | "notas" | "pendencias";

interface Props {
  initialTab: FiscalTab;
  blingResult: "connected" | "error" | null;
  configuration: FiscalConfigurationView;
  profiles: FiscalProfileView[];
  missing: FiscalMissingProfiles;
  assignments: FiscalProfileAssignments;
  pending: FiscalDocumentPage;
  documents: FiscalDocumentPage;
  unissued: FiscalUnissuedSale[];
  today: string;
  unissuedActions: FiscalUnissuedActions;
  /** Test seam; by default read from the session (owners, admins and fiscal.configure). */
  canConfigure?: boolean;
  configurationActions: FiscalConfigurationActions;
  profileActions: FiscalProfileActions;
  documentActions: FiscalDocumentActions;
}

const TABS: Array<[FiscalTab, string]> = [
  ["configuracao", "Configuracao"],
  ["perfis", "Perfis fiscais"],
  ["vendas", "Vendas sem NFC-e"],
  ["notas", "Notas"],
  ["pendencias", "Pendencias"],
];

export function FiscalClient(props: Props) {
  const [tab, setTab] = useState<FiscalTab>(props.initialTab);
  const [configuration, setConfiguration] = useState(props.configuration);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<OperationState>(() =>
    props.blingResult === "connected"
      ? { status: "success", message: "Conta Bling conectada. Configure a natureza de operacao e as formas de pagamento." }
      : props.blingResult === "error"
        ? { status: "error", message: "Nao foi possivel conectar a conta Bling. Tente novamente." }
        : idleOperationState
  );

  const [sessionCanConfigure, setSessionCanConfigure] = useState(true);

  useEffect(() => setConfiguration(props.configuration), [props.configuration]);
  useEffect(() => {
    const session = readAuthSession();
    if (!session) return;
    setSessionCanConfigure(
      Boolean(session.user.isMaster || session.user.role === "OWNER" || session.user.role === "ADMIN" || session.permissions.includes("fiscal.configure"))
    );
  }, []);
  const canConfigure = props.canConfigure ?? sessionCanConfigure;
  useEffect(() => {
    if (!canConfigure && (tab === "configuracao" || tab === "perfis")) setTab("pendencias");
  }, [canConfigure, tab]);

  async function run<T>(action: () => Promise<FiscalActionState<T>>, onSuccess?: (data: T) => void): Promise<void> {
    if (busy) return;
    setBusy(true);
    setFeedback({ status: "pending", message: "Processando solicitacao." });
    try {
      const result = await action();
      setFeedback({ status: result.status, message: result.message });
      if (result.status === "success") onSuccess?.(result.data as T);
    } catch (error) {
      setFeedback({ status: "error", message: error instanceof Error ? error.message : "Nao foi possivel concluir a operacao." });
    } finally {
      setBusy(false);
    }
  }

  const pendingCount = props.pending.total;
  const visibleTabs = canConfigure ? TABS : TABS.filter(([key]) => key === "vendas" || key === "notas" || key === "pendencias");

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <section className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-tomato">Fiscal</p>
            <h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold">
              <ReceiptText aria-hidden className="h-7 w-7" /> NFC-e
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Emissao da nota fiscal de consumidor das vendas de balcao, comandas e vendas importadas, pelo provedor configurado.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {configuration.environment === "HOMOLOGATION" ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">Homologacao</span>
            ) : null}
            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold ${configuration.enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}
              data-testid="fiscal-status"
            >
              {configuration.enabled ? `Ativa (${configuration.emissionMode === "AUTOMATIC" ? "automatica" : "manual"})` : "Desativada"}
            </span>
          </div>
        </header>

        <OperationFeedback onDismiss={() => setFeedback(idleOperationState)} state={feedback} />

        <div className="flex gap-2 border-b border-slate-200" role="tablist">
          {visibleTabs.map(([key, label]) => (
            <button
              aria-selected={tab === key}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${tab === key ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}
              key={key}
              onClick={() => setTab(key)}
              role="tab"
              type="button"
            >
              {label}
              {key === "vendas" && props.unissued.length > 0 ? (
                <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">{props.unissued.length}</span>
              ) : null}
              {key === "pendencias" && pendingCount > 0 ? (
                <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">{pendingCount}</span>
              ) : null}
            </button>
          ))}
        </div>

        {tab === "configuracao" && canConfigure ? (
          <FiscalConfigurationTab actions={props.configurationActions} busy={busy} configuration={configuration} onConfiguration={setConfiguration} run={run} />
        ) : null}
        {tab === "perfis" && canConfigure ? (
          <FiscalProfilesTab
            actions={props.profileActions}
            assignments={props.assignments}
            busy={busy}
            missing={props.missing}
            profiles={props.profiles}
            run={run}
          />
        ) : null}
        {tab === "vendas" ? (
          <FiscalUnissuedTab
            actions={props.unissuedActions}
            busy={busy}
            emissionMode={configuration.emissionMode}
            enabled={configuration.enabled}
            initialSales={props.unissued}
            run={run}
            today={props.today}
          />
        ) : null}
        {tab === "notas" ? (
          <FiscalDocumentsTab
            actions={props.documentActions}
            busy={busy}
            defaultCancelReason={configuration.defaultCancelReason}
            environment={configuration.environment}
            initialPage={props.documents}
            mode="all"
            run={run}
          />
        ) : null}
        {tab === "pendencias" ? (
          <FiscalDocumentsTab
            actions={props.documentActions}
            busy={busy}
            defaultCancelReason={configuration.defaultCancelReason}
            initialPage={props.pending}
            mode="pending"
            run={run}
          />
        ) : null}
      </section>
    </main>
  );
}
