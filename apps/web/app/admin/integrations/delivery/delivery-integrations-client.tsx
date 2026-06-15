"use client";

import type { DeliveryIntegrationDetail, OperationState, OrderPlatform } from "@burgoos/types";
import { OperationForm } from "../../../../components/admin/operation-form";
import { SubmitButton } from "../../../../components/admin/submit-button";
import { IntegrationHealthBadge } from "../../../../components/admin/integration-health-badge";

interface DeliveryIntegrationsClientProps {
  integrations: DeliveryIntegrationDetail[];
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
            <section
              className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
              key={integration.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{integration.displayName}</h2>
                    <IntegrationHealthBadge status={integration.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Merchant: {integration.externalMerchantId ?? "pendente"} · Credencial:{" "}
                    {integration.credentialStatus ?? "pendente"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <TinyAction action={validateAction} id={integration.id} label="Validar" />
                  <TinyAction action={activateAction} id={integration.id} label="Ativar" />
                  <TinyAction action={pauseAction} id={integration.id} label="Pausar" />
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <OperationForm
                  action={updateAction}
                  className="grid gap-3"
                  feedbackClassName="mt-3"
                >
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

                <OperationForm
                  action={credentialAction}
                  className="grid gap-3"
                  feedbackClassName="mt-3"
                >
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
                  <SubmitButton pendingLabel="Salvando credenciais...">
                    Salvar credenciais
                  </SubmitButton>
                </OperationForm>
              </div>
            </section>
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
