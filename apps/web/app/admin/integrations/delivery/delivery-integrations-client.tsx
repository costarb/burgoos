"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import type {
  DeliveryIntegrationDetail,
  DeliveryIntegrationHealth,
  OperationState,
  OrderPlatform,
} from "@burgoos/types";
import { IntegrationHealthBadge } from "../../../../components/admin/integration-health-badge";
import { OperationForm } from "../../../../components/admin/operation-form";
import { SubmitButton } from "../../../../components/admin/submit-button";

interface DeliveryIntegrationsClientProps {
  integrations: DeliveryIntegrationDetail[];
  healthByIntegrationId: Record<string, DeliveryIntegrationHealth>;
  orderPlatforms: OrderPlatform[];
  createAction: (previousState: OperationState, formData: FormData) => Promise<OperationState>;
  authorizationCodeAction: (
    previousState: OperationState,
    formData: FormData
  ) => Promise<AuthorizationCodeState>;
  updateAction: (previousState: OperationState, formData: FormData) => Promise<OperationState>;
  credentialAction: (previousState: OperationState, formData: FormData) => Promise<OperationState>;
  validateAction: (previousState: OperationState, formData: FormData) => Promise<OperationState>;
  activateAction: (previousState: OperationState, formData: FormData) => Promise<OperationState>;
  pauseAction: (previousState: OperationState, formData: FormData) => Promise<OperationState>;
}

export function DeliveryIntegrationsClient({
  integrations,
  healthByIntegrationId,
  orderPlatforms,
  createAction,
  authorizationCodeAction,
  updateAction,
  credentialAction,
  validateAction,
  activateAction,
  pauseAction,
}: DeliveryIntegrationsClientProps) {
  const ifoodPlatform = orderPlatforms.find((platform) =>
    platform.name.toLowerCase().includes("ifood")
  );

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <section className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold uppercase text-tomato">Integracoes</p>
        <h1 className="mt-1 text-3xl font-semibold">Delivery</h1>

        <OperationForm
          action={createAction}
          className="mt-8 grid gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_1fr_160px_120px_120px]"
          feedbackClassName="mt-4"
        >
          <input name="provider" type="hidden" value="IFOOD" />
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            defaultValue="iFood"
            maxLength={80}
            name="displayName"
            placeholder="Nome"
            required
          />
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            name="externalMerchantId"
            placeholder="Merchant ID iFood"
          />
          <select
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            defaultValue={ifoodPlatform?.id ?? ""}
            name="orderPlatformId"
            required
          >
            <option value="">Canal</option>
            {orderPlatforms.map((platform) => (
              <option key={platform.id} value={platform.id}>
                {platform.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input defaultChecked name="pollingEnabled" type="checkbox" />
            Polling
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input name="webhookEnabled" type="checkbox" />
            Webhook
          </label>
          <SubmitButton className="md:col-span-5" pendingLabel="Salvando integracao...">
            Salvar integracao
          </SubmitButton>
        </OperationForm>

        <div className="mt-6 grid gap-4">
          {integrations.map((integration) => (
            <DeliveryIntegrationCard
              activateAction={activateAction}
              authorizationCodeAction={authorizationCodeAction}
              credentialAction={credentialAction}
              health={healthByIntegrationId[integration.id]}
              integration={integration}
              key={integration.id}
              pauseAction={pauseAction}
              updateAction={updateAction}
              validateAction={validateAction}
            />
          ))}
          {integrations.length === 0 ? (
            <p className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-500">
              Nenhuma integracao configurada para esta loja.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function DeliveryIntegrationCard({
  integration,
  health,
  updateAction,
  authorizationCodeAction,
  credentialAction,
  validateAction,
  activateAction,
  pauseAction,
}: {
  integration: DeliveryIntegrationDetail;
  health?: DeliveryIntegrationHealth;
  updateAction: (previousState: OperationState, formData: FormData) => Promise<OperationState>;
  authorizationCodeAction: (
    previousState: OperationState,
    formData: FormData
  ) => Promise<AuthorizationCodeState>;
  credentialAction: (previousState: OperationState, formData: FormData) => Promise<OperationState>;
  validateAction: (previousState: OperationState, formData: FormData) => Promise<OperationState>;
  activateAction: (previousState: OperationState, formData: FormData) => Promise<OperationState>;
  pauseAction: (previousState: OperationState, formData: FormData) => Promise<OperationState>;
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{integration.displayName}</h2>
            <IntegrationHealthBadge status={integration.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Merchant: {integration.externalMerchantId ?? "pendente"} | Credencial:{" "}
            {integration.credentialStatus ?? "pendente"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {providerCapabilityLabels(integration.capabilities).map((capability) => (
              <span
                className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600"
                key={capability}
              >
                {capability}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <TinyAction action={validateAction} id={integration.id} label="Validar" />
          <TinyAction action={activateAction} id={integration.id} label="Ativar" />
          <TinyAction action={pauseAction} id={integration.id} label="Pausar" />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <OperationForm action={updateAction} className="grid gap-3" feedbackClassName="mt-3">
          <input name="id" type="hidden" value={integration.id} />
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            defaultValue={integration.displayName}
            name="displayName"
            required
          />
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            defaultValue={integration.externalMerchantId ?? ""}
            name="externalMerchantId"
            placeholder="Merchant ID"
          />
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                defaultChecked={integration.pollingEnabled}
                name="pollingEnabled"
                type="checkbox"
              />
              Polling
            </label>
            <label className="flex items-center gap-2">
              <input
                defaultChecked={integration.webhookEnabled}
                name="webhookEnabled"
                type="checkbox"
              />
              Webhook
            </label>
          </div>
          <SubmitButton pendingLabel="Salvando...">Salvar ajustes</SubmitButton>
        </OperationForm>

        <IfoodCredentialsPanel
          authorizationCodeAction={authorizationCodeAction}
          credentialAction={credentialAction}
          integrationId={integration.id}
        />
      </div>

      {health ? <IntegrationHealthPanel health={health} /> : null}
    </section>
  );
}

interface AuthorizationCodeState extends OperationState {
  data?: {
    userCode: string;
    authorizationCodeVerifier: string;
    verificationUrl: string | null;
    verificationUrlComplete: string | null;
    expiresIn: number | null;
  };
}

function IfoodCredentialsPanel({
  integrationId,
  authorizationCodeAction,
  credentialAction,
}: {
  integrationId: string;
  authorizationCodeAction: (
    previousState: OperationState,
    formData: FormData
  ) => Promise<AuthorizationCodeState>;
  credentialAction: (previousState: OperationState, formData: FormData) => Promise<OperationState>;
}) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [authorizationCode, setAuthorizationCode] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [authorizationState, setAuthorizationState] = useState<AuthorizationCodeState>({
    status: "idle",
    message: "",
  });
  const [pendingAuthorization, setPendingAuthorization] = useState(false);
  const verifier = authorizationState.data?.authorizationCodeVerifier ?? "";
  const canSaveCredentials =
    Boolean(clientId && clientSecret && refreshToken) ||
    Boolean(clientId && clientSecret && authorizationCode && verifier);

  async function submitAuthorization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingAuthorization) {
      return;
    }

    setPendingAuthorization(true);
    setAuthorizationState({ status: "pending", message: "Gerando codigo iFood." });
    try {
      setAuthorizationState(
        await authorizationCodeAction(authorizationState, new FormData(event.currentTarget))
      );
    } catch (error) {
      setAuthorizationState({
        status: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel gerar o codigo iFood.",
      });
    } finally {
      setPendingAuthorization(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Credenciais iFood</h3>
        <p className="mt-1 text-xs text-slate-500">
          Primeiro gere o codigo, autorize no portal iFood e depois salve o authorization code.
        </p>
      </div>
      <form className="grid gap-3" onSubmit={submitAuthorization}>
        <input name="id" type="hidden" value={integrationId} />
        <input
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          name="clientId"
          onChange={(event) => setClientId(event.target.value)}
          placeholder="Client ID"
          required
          value={clientId}
        />
        <input
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          name="clientSecret"
          onChange={(event) => setClientSecret(event.target.value)}
          placeholder="Client secret"
          required
          type="password"
          value={clientSecret}
        />
        <button
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={pendingAuthorization}
          type="submit"
        >
          {pendingAuthorization ? "Gerando..." : "Gerar codigo iFood"}
        </button>
      </form>

      {authorizationState.message ? (
        <p
          className={
            authorizationState.status === "error"
              ? "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              : "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
          }
        >
          {authorizationState.message}
        </p>
      ) : null}

      {authorizationState.data ? (
        <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <CopyField label="User code" value={authorizationState.data.userCode} />
          <CopyField
            label="URL de autorizacao"
            value={
              authorizationState.data.verificationUrlComplete ??
              authorizationState.data.verificationUrl ??
              ""
            }
          />
          <p className="text-xs text-slate-500">
            Expira em {authorizationState.data.expiresIn ?? 600} segundos. Depois de aprovar no
            iFood, informe o authorization code abaixo.
          </p>
        </div>
      ) : null}

      <OperationForm action={credentialAction} className="grid gap-3" feedbackClassName="mt-3">
        <input name="id" type="hidden" value={integrationId} />
        <input name="clientId" type="hidden" value={clientId} />
        <input name="clientSecret" type="hidden" value={clientSecret} />
        <input name="authorizationCodeVerifier" type="hidden" value={verifier} />
        <input
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          name="authorizationCode"
          onChange={(event) => setAuthorizationCode(event.target.value)}
          placeholder="Authorization code"
          value={authorizationCode}
        />
        <input
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          name="refreshToken"
          onChange={(event) => setRefreshToken(event.target.value)}
          placeholder="Refresh token opcional"
          value={refreshToken}
        />
        <p className="text-xs text-slate-500">
          Para apps distribuidos, gere o codigo iFood, autorize no portal e salve com o
          authorization code retornado. O sistema envia automaticamente o verifier gerado junto com
          o codigo.
        </p>
        <SubmitButton disabled={!canSaveCredentials} pendingLabel="Salvando credenciais...">
          Salvar credenciais
        </SubmitButton>
      </OperationForm>
    </div>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="grid gap-1">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
          readOnly
          value={value}
        />
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
          onClick={copy}
          type="button"
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}

function IntegrationHealthPanel({ health }: { health: DeliveryIntegrationHealth }) {
  const counters = [
    ["Eventos pendentes", health.pendingEvents],
    ["Eventos com falha", health.failedEvents],
    ["Sincronizacoes em retry", health.retryableSyncs],
    ["Excecoes pendentes", health.pendingExceptions],
    ["Disputas pendentes", health.pendingDisputes],
  ];

  return (
    <div className="mt-5 grid gap-4 border-t border-slate-100 pt-4 lg:grid-cols-[1fr_1fr]">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Saude operacional</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {counters.map(([label, value]) => (
            <div className="rounded-md border border-slate-200 px-3 py-2" key={label}>
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-lg font-semibold">{value}</p>
            </div>
          ))}
          <div className="rounded-md border border-slate-200 px-3 py-2">
            <p className="text-xs text-slate-500">Token</p>
            <p
              className={
                health.tokenRequiresAttention
                  ? "text-sm font-semibold text-amber-700"
                  : "text-sm font-semibold text-slate-700"
              }
            >
              {health.tokenExpiresInMinutes === null
                ? "Sem vencimento informado"
                : `${health.tokenExpiresInMinutes} min`}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {health.homologationChecks.map((check) => (
            <span
              className={
                check.passed
                  ? "rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"
                  : "rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700"
              }
              key={check.key}
              title={check.message ?? undefined}
            >
              {check.key}: {check.passed ? "ok" : "pendente"}
            </span>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-800">Auditoria recente</h3>
        <div className="mt-3 overflow-hidden rounded-md border border-slate-200">
          {health.recentAudits.length > 0 ? (
            health.recentAudits.map((audit) => (
              <div
                className="grid grid-cols-[1fr_auto] gap-3 border-b border-slate-100 px-3 py-2 text-xs last:border-b-0"
                key={audit.id}
              >
                <div>
                  <p className="font-medium text-slate-700">{audit.action}</p>
                  <p className="text-slate-500">
                    {audit.entityType} | {audit.result}
                  </p>
                </div>
                <time className="text-slate-400">
                  {new Intl.DateTimeFormat("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(audit.createdAt))}
                </time>
              </div>
            ))
          ) : (
            <p className="px-3 py-2 text-xs text-slate-500">Sem auditoria registrada.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function providerCapabilityLabels(
  capabilities: DeliveryIntegrationDetail["capabilities"] | undefined
): string[] {
  if (!capabilities) {
    return ["Capacidades pendentes"];
  }

  return [
    capabilities.supportsPolling ? "Polling" : null,
    capabilities.supportsWebhook ? "Webhook" : null,
    capabilities.supportsMerchantValidation ? "Validacao de merchant" : null,
    capabilities.supportsOrderConfirmation ? "Aceite" : null,
    capabilities.supportsOrderRefusal ? "Recusa" : null,
    ...capabilities.supportedStatusActions.map((action) => statusActionLabel(action)),
  ].filter((label): label is string => Boolean(label));
}

function statusActionLabel(
  action: DeliveryIntegrationDetail["capabilities"]["supportedStatusActions"][number]
) {
  const labels: Record<
    DeliveryIntegrationDetail["capabilities"]["supportedStatusActions"][number],
    string
  > = {
    CONFIRM: "Confirmacao",
    REFUSE: "Recusa",
    START_PREPARATION: "Inicio de preparo",
    READY_TO_PICKUP: "Pronto para retirada",
    DISPATCH: "Despacho",
    DELIVER: "Entrega",
    REQUEST_CANCELLATION: "Cancelamento",
    RESPOND_DISPUTE: "Disputa",
  };

  return labels[action];
}

function TinyAction({
  action,
  id,
  label,
}: {
  action: (previousState: OperationState, formData: FormData) => Promise<OperationState>;
  id: string;
  label: string;
}) {
  return (
    <OperationForm action={action}>
      <input name="id" type="hidden" value={id} />
      <SubmitButton className="bg-slate-900 px-3 py-2 text-xs" pendingLabel="...">
        {label}
      </SubmitButton>
    </OperationForm>
  );
}
