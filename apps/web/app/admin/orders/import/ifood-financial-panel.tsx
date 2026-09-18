"use client";

import type {
  DeliveryIntegrationDetail,
  IfoodFinancialReadiness,
  SalesImportRunView,
  SalesIntegrationView,
} from "@rrfive/types";
import React, { FormEvent, useEffect, useState } from "react";
import type { AdminProduct } from "../../../../lib/api";
import type {
  IfoodFinancialReconciliationRunView,
  IfoodReconciliationFileView,
} from "../../../../lib/api";
import {
  confirmSalesImportRun,
  createSalesImportRun,
  createSalesIntegration,
  getSalesImportRun,
  listDeliveryIntegrations,
  setSalesIntegrationStatus,
  updateSalesIntegration,
  createIfoodFinancialReconciliation,
  getIfoodFinancialReconciliation,
  listIfoodFinancialReconciliations,
  requestIfoodReconciliationFile,
  getIfoodReconciliationFile,
  getIfoodReconciliationFileDownloadUrl,
  getIfoodFinancialReadiness,
  revalidateIfoodFinancialReadiness,
} from "../../../../lib/api";

export function IfoodFinancialPanel({
  token,
  products,
  integration,
  onIntegrationChange,
  onCompleted,
}: {
  token: string;
  products: AdminProduct[];
  integration: SalesIntegrationView | null;
  onIntegrationChange: (integration: SalesIntegrationView) => void;
  onCompleted: () => Promise<void>;
}) {
  const [connections, setConnections] = useState<DeliveryIntegrationDetail[]>([]);
  const [strategy, setStrategy] = useState<"PRICE_WEIGHTED" | "FIXED_PRODUCT">("FIXED_PRODUCT");
  const [run, setRun] = useState<SalesImportRunView | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [reconciliations, setReconciliations] = useState<IfoodFinancialReconciliationRunView[]>([]);
  const [file, setFile] = useState<IfoodReconciliationFileView | null>(null);
  const [readiness, setReadiness] = useState<IfoodFinancialReadiness | null>(null);

  useEffect(() => {
    void listDeliveryIntegrations(token)
      .then((items) => setConnections(items.filter((item) => item.provider === "IFOOD")))
      .catch((error: unknown) =>
        setMessage(error instanceof Error ? error.message : "Falha ao listar conexoes iFood")
      );
  }, [token]);

  useEffect(() => {
    if (!integration) return;
    void listIfoodFinancialReconciliations(token, integration.id)
      .then((result) => setReconciliations(result.items))
      .catch(() => undefined);
    void getIfoodFinancialReadiness(token, integration.id)
      .then(setReadiness)
      .catch(() => undefined);
  }, [integration, token]);

  async function revalidateReadiness() {
    if (!integration) return;
    setBusy(true);
    try {
      setReadiness(await revalidateIfoodFinancialReadiness(token, integration.id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao validar acesso financeiro");
    } finally {
      setBusy(false);
    }
  }

  async function configure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const data = new FormData(event.currentTarget);
      const deliveryIntegrationId = String(data.get("deliveryIntegrationId"));
      const delivery = connections.find((item) => item.id === deliveryIntegrationId);
      if (!delivery?.externalMerchantId)
        throw new Error("Selecione uma conexao iFood com merchant");
      const payload = {
        provider: "IFOOD" as const,
        channel: "API" as const,
        displayName: "iFood Financeiro",
        externalMerchantId: delivery.externalMerchantId,
        environment: delivery.environment ?? ("PRODUCTION" as const),
        credentialMode: "OAUTH" as const,
        deliveryIntegrationId,
      };
      let current = integration
        ? await updateSalesIntegration(token, integration.id, payload)
        : await createSalesIntegration(token, payload);
      current = await setSalesIntegrationStatus(token, current.id, "ACTIVE");
      onIntegrationChange(current);
      setMessage("Integracao financeira vinculada sem copiar a credencial operacional.");
      await onCompleted();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao vincular iFood");
    } finally {
      setBusy(false);
    }
  }

  async function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!integration) return;
    const data = new FormData(event.currentTarget);
    const startDate = String(data.get("startDate"));
    const endDate = String(data.get("endDate"));
    if (!isIfoodPeriodValid(startDate, endDate)) {
      setMessage("Selecione um periodo entre 1 e 90 dias.");
      return;
    }
    setBusy(true);
    setMessage("Consultando todas as paginas da API Sales iFood...");
    try {
      const created = await createSalesImportRun(token, {
        integrationId: integration.id,
        startDate,
        endDate,
        strategy,
        fixedProductId:
          strategy === "FIXED_PRODUCT" ? String(data.get("fixedProductId")) : undefined,
      });
      setRun(created);
      let current = created;
      for (
        let attempt = 0;
        attempt < 60 && ["PENDING", "FETCHING"].includes(current.status);
        attempt += 1
      ) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        current = await getSalesImportRun(token, created.id);
        setRun(current);
      }
      setMessage(
        ["PREVIEW_READY", "PARTIALLY_READY"].includes(current.status)
          ? "Pre-visualizacao iFood pronta para conferencia."
          : (current.errorMessage ?? "A consulta nao produziu dias prontos.")
      );
      await onCompleted();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao consultar vendas iFood");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!run) return;
    setBusy(true);
    try {
      await confirmSalesImportRun(token, run.id);
      let current = await getSalesImportRun(token, run.id);
      for (
        let attempt = 0;
        attempt < 60 && ["PREVIEW_READY", "PARTIALLY_READY", "IMPORTING"].includes(current.status);
        attempt += 1
      ) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        current = await getSalesImportRun(token, run.id);
      }
      setRun(current);
      setMessage("Importacao iFood concluida.");
      await onCompleted();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao importar vendas iFood");
    } finally {
      setBusy(false);
    }
  }

  async function reconcile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!integration) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      let current = await createIfoodFinancialReconciliation(
        token,
        integration.id,
        String(data.get("reconciliationStartDate")),
        String(data.get("reconciliationEndDate"))
      );
      for (
        let attempt = 0;
        attempt < 60 && ["PENDING", "FETCHING"].includes(current.status);
        attempt += 1
      ) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        current = await getIfoodFinancialReconciliation(token, integration.id, current.id);
      }
      setReconciliations((items) => [current, ...items.filter((item) => item.id !== current.id)]);
      setMessage(
        current.status === "COMPLETED"
          ? "Conciliação financeira concluída."
          : (current.errorMessage ?? "Conciliação parcial; pode ser retomada.")
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na conciliação iFood");
    } finally {
      setBusy(false);
    }
  }

  async function requestFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!integration) return;
    setBusy(true);
    try {
      let current = await requestIfoodReconciliationFile(
        token,
        integration.id,
        String(new FormData(event.currentTarget).get("competence"))
      );
      for (
        let attempt = 0;
        attempt < 10 && ["REQUESTED", "PROCESSING"].includes(current.status);
        attempt += 1
      ) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(30_000, 1000 * 2 ** attempt)));
        current = await getIfoodReconciliationFile(token, integration.id, current.requestId);
      }
      setFile(current);
      setMessage(
        current.reused ? "Solicitação recente reutilizada." : "Arquivo de conciliação solicitado."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao solicitar arquivo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-xl font-semibold">Vendas financeiras iFood</h2>
        <p className="mt-1 text-sm text-slate-600">
          Consulte vendas agregadas por periodo. A conexao operacional fornece o merchant e o token,
          sem duplicacao de credenciais.
        </p>
      </div>
      <form className="grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={configure}>
        <label className="grid gap-1 text-sm font-semibold">
          Conexao operacional iFood
          <select
            name="deliveryIntegrationId"
            required
            defaultValue={integration?.deliveryIntegrationId ?? ""}
            className="rounded border px-3 py-2 font-normal"
          >
            <option value="">Selecione</option>
            {connections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.displayName} - {connection.externalMerchantId ?? "merchant ausente"} (
                {connection.environment ?? "PRODUCTION"})
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={busy}
          className="self-end rounded bg-ink px-4 py-2 font-semibold text-white disabled:opacity-60"
        >
          {integration ? "Atualizar vinculo" : "Vincular e ativar"}
        </button>
      </form>
      {connections.length === 0 ? (
        <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
          Configure primeiro uma integracao operacional iFood com merchant e credenciais.
        </p>
      ) : null}
      {integration?.status === "ACTIVE" ? (
        <IfoodReadinessSummary
          readiness={readiness}
          busy={busy}
          onRevalidate={() => void revalidateReadiness()}
        />
      ) : null}
      {integration?.status === "ACTIVE" ? (
        <form className="grid gap-3 border-t pt-5 md:grid-cols-4" onSubmit={preview}>
          <label className="grid gap-1 text-sm font-semibold">
            Data inicial
            <input
              aria-label="Data inicial iFood"
              name="startDate"
              type="date"
              required
              className="rounded border px-3 py-2 font-normal"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Data final
            <input
              aria-label="Data final iFood"
              name="endDate"
              type="date"
              required
              className="rounded border px-3 py-2 font-normal"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Atribuicao
            <select
              aria-label="Atribuicao iFood"
              value={strategy}
              onChange={(event) => setStrategy(event.target.value as typeof strategy)}
              className="rounded border px-3 py-2 font-normal"
            >
              <option value="FIXED_PRODUCT">Produto consolidado</option>
            </select>
          </label>
          {strategy === "FIXED_PRODUCT" ? (
            <label className="grid gap-1 text-sm font-semibold">
              Produto consolidado
              <select
                name="fixedProductId"
                required
                className="rounded border px-3 py-2 font-normal"
              >
                <option value="">Selecione</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            disabled={busy}
            className="rounded bg-tomato px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            Consultar vendas iFood
          </button>
        </form>
      ) : null}
      {run ? <IfoodRunSummary run={run} busy={busy} onConfirm={() => void confirm()} /> : null}
      {integration?.status === "ACTIVE" ? (
        <section className="grid gap-3 border-t pt-5" aria-labelledby="ifood-reconciliation-title">
          <h3 id="ifood-reconciliation-title" className="font-semibold">
            Conciliação e repasses
          </h3>
          <p className="text-sm text-slate-600">
            A comparação considera somente eventos com impacto no repasse; lançamentos informativos
            permanecem armazenados para auditoria.
          </p>
          <form
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]"
            onSubmit={reconcile}
          >
            <label className="grid gap-1 text-sm font-semibold">
              Início
              <input
                name="reconciliationStartDate"
                type="date"
                required
                className="min-w-0 rounded border px-3 py-2 font-normal"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Fim
              <input
                name="reconciliationEndDate"
                type="date"
                required
                className="min-w-0 rounded border px-3 py-2 font-normal"
              />
            </label>
            <button
              disabled={busy}
              className="self-end rounded bg-ink px-4 py-2 font-semibold text-white disabled:opacity-60"
            >
              Conciliar eventos
            </button>
          </form>
          <IfoodReconciliationSummary items={reconciliations} />
          <form className="grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={requestFile}>
            <label className="grid gap-1 text-sm font-semibold">
              Competência do arquivo
              <input
                name="competence"
                type="month"
                required
                className="min-w-0 rounded border px-3 py-2 font-normal"
              />
            </label>
            <button
              disabled={busy}
              className="self-end rounded border px-4 py-2 font-semibold disabled:opacity-60"
            >
              Gerar arquivo
            </button>
          </form>
          {file ? (
            <IfoodReconciliationFileSummary file={file} integrationId={integration.id} />
          ) : null}
        </section>
      ) : null}
      <p role="status" aria-live="polite" className="min-h-5 text-sm font-medium text-slate-700">
        {message}
      </p>
    </div>
  );
}

export function IfoodReadinessSummary({
  readiness,
  busy,
  onRevalidate,
}: {
  readiness: IfoodFinancialReadiness | null;
  busy: boolean;
  onRevalidate: () => void;
}) {
  const statusLabel: Record<IfoodFinancialReadiness["status"], string> = {
    PENDING_PERMISSION: "Permissao financeira em propagacao",
    READY_TEST: "Pronta para testes",
    READY_PRODUCTION: "Pronta para producao",
    REQUIRES_ATTENTION: "Requer atencao",
  };
  return (
    <section
      className="grid gap-2 rounded border p-4 text-sm"
      aria-labelledby="ifood-readiness-title"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 id="ifood-readiness-title" className="font-semibold">
          Saude da conexao financeira
        </h3>
        <button
          type="button"
          disabled={busy || !readiness}
          onClick={onRevalidate}
          className="rounded border px-3 py-1 font-semibold disabled:opacity-60"
        >
          Validar novamente
        </button>
      </div>
      {readiness ? (
        <>
          <p className="font-medium">{statusLabel[readiness.status]}</p>
          <p className="text-slate-600">
            Ambiente {readiness.environment} · merchant {readiness.merchantId || "nao vinculado"}
          </p>
          <p className="text-slate-600">
            Ultima validacao{" "}
            {readiness.lastValidatedAt
              ? new Date(readiness.lastValidatedAt).toLocaleString("pt-BR")
              : "ainda nao realizada"}
          </p>
          <ul className="grid gap-1">
            {readiness.checks.map((check) => (
              <li
                key={check.code}
                className={check.passed ? "text-emerald-700" : "text-amber-800"}
              >
                {check.passed ? "OK" : "Pendente"} — {check.code}
                {check.message ? `: ${check.message}` : ""}
              </li>
            ))}
          </ul>
          {readiness.status === "REQUIRES_ATTENTION" ? (
            <p className="rounded border border-rose-200 bg-rose-50 p-2 text-rose-800">
              A conexao operacional pode precisar de reautorizacao. Nenhum dado historico foi
              perdido.
            </p>
          ) : null}
          <p className="font-medium">
            Ativacao produtiva {readiness.productionEnabled ? "liberada" : "bloqueada"}
          </p>
        </>
      ) : (
        <p className="text-slate-600">Validando acesso financeiro...</p>
      )}
    </section>
  );
}

export function IfoodReconciliationSummary({
  items,
}: {
  items: IfoodFinancialReconciliationRunView[];
}) {
  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <div key={item.id} className="rounded border p-3 text-sm">
          <p className="font-semibold">
            {item.startDate} a {item.endDate} — {item.status}
          </p>
          <p>
            Eventos {item.counts.events} · repasses {item.counts.settlements} · divergências{" "}
            {item.counts.divergent}
          </p>
          {item.counts.divergent > 0 ? (
            <p className="text-amber-800">
              Há valores acima da tolerância de R$ 0,01 para revisar.
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function IfoodReconciliationFileSummary({
  file,
  integrationId,
}: {
  file: IfoodReconciliationFileView;
  integrationId: string;
}) {
  return (
    <div className="rounded border p-3 text-sm">
      <p>
        Arquivo {file.competence}: {file.status}
      </p>
      <p>
        {file.orderCount ?? 0} pedidos · {file.lineCount ?? 0} linhas
      </p>
      {file.status === "READY" ? (
        <a
          className="font-semibold underline"
          href={getIfoodReconciliationFileDownloadUrl(integrationId, file.requestId)}
        >
          Baixar CSV compactado
        </a>
      ) : null}
    </div>
  );
}

export function IfoodRunSummary({
  run,
  busy,
  onConfirm,
}: {
  run: SalesImportRunView;
  busy: boolean;
  onConfirm: () => void;
}) {
  return (
    <div className="rounded border bg-slate-50 p-4 text-sm" aria-live="polite">
      <p className="font-semibold">Execucao {run.status}</p>
      <p className="mt-1">
        Encontradas {run.counts.found} · pedidos existentes {run.counts.existingOrders ?? 0} ·
        candidatos historicos {run.counts.historicalCandidates ?? 0} · revisao{" "}
        {run.counts.unknown ?? 0}
      </p>
      {run.status === "COMPLETED" || run.status === "COMPLETED_WITH_ERRORS" ? (
        <p className="mt-1 font-medium">
          Enriquecidos {run.counts.enriched ?? 0} · criados {run.counts.created ?? 0} ·
          reconciliados {run.counts.reconciled ?? 0}
        </p>
      ) : null}
      {(run.counts.historicalCandidates ?? 0) > 0 ? (
        <p className="mt-2 text-amber-800">
          Pedidos ausentes serao criados com um unico item consolidado; itens e cliente nao sao
          fornecidos pela API financeira.
        </p>
      ) : null}
      {run.days?.map((day) => (
        <p key={day.date} className="text-slate-600">
          {day.date}: {day.status} ({day.pagesFetched}/{day.totalPages ?? 0} paginas)
        </p>
      ))}
      {["PREVIEW_READY", "PARTIALLY_READY"].includes(run.status) ? (
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="mt-3 rounded bg-ink px-4 py-2 font-semibold text-white"
        >
          Confirmar importacao
        </button>
      ) : null}
    </div>
  );
}

export function isIfoodPeriodValid(startDate: string, endDate: string): boolean {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return Number.isFinite(days) && days >= 1 && days <= 90;
}
