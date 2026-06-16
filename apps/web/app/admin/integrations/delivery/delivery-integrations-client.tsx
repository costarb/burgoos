"use client";

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
  credentialAction,
  validateAction,
  activateAction,
  pauseAction,
}: {
  integration: DeliveryIntegrationDetail;
  health?: DeliveryIntegrationHealth;
  updateAction: (previousState: OperationState, formData: FormData) => Promise<OperationState>;
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

        <OperationForm action={credentialAction} className="grid gap-3" feedbackClassName="mt-3">
          <input name="id" type="hidden" value={integration.id} />
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            name="clientId"
            placeholder="Client ID"
            required
          />
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            name="clientSecret"
            placeholder="Client secret"
            required
            type="password"
          />
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            name="authorizationCode"
            placeholder="Authorization code"
          />
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            name="refreshToken"
            placeholder="Refresh token"
          />
          <SubmitButton pendingLabel="Salvando credenciais...">Salvar credenciais</SubmitButton>
        </OperationForm>
      </div>

      {health ? <IntegrationHealthPanel health={health} /> : null}
    </section>
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
  capabilities: DeliveryIntegrationDetail["capabilities"]
): string[] {
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
