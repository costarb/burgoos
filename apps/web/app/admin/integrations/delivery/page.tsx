import type { OperationState } from "@burgoos/types";
import { revalidatePath } from "next/cache";
import {
  activateDeliveryIntegration,
  createDeliveryIntegration,
  getAdminToken,
  getDeliveryIntegrationHealth,
  getDeliveryIntegrations,
  pauseDeliveryIntegration,
  requestDeliveryIntegrationAuthorizationCode,
  saveDeliveryIntegrationCredentials,
  updateDeliveryIntegration,
  validateDeliveryIntegration,
} from "../../../../lib/api";
import { DeliveryIntegrationsClient } from "./delivery-integrations-client";

export const dynamic = "force-dynamic";

function boolFromForm(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}

function stringOrNull(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value ? value : null;
}

export default async function DeliveryIntegrationsPage() {
  const { integrations, orderPlatforms } = await getDeliveryIntegrations();
  const token = await getAdminToken();
  const healthEntries = await Promise.all(
    integrations.map(async (integration) => [
      integration.id,
      await getDeliveryIntegrationHealth(token, integration.id),
    ])
  );
  const healthByIntegrationId = Object.fromEntries(healthEntries);

  async function create(_state: OperationState, formData: FormData): Promise<OperationState> {
    "use server";

    try {
      await createDeliveryIntegration(await getAdminToken(), {
        provider: "IFOOD",
        displayName: String(formData.get("displayName") ?? "iFood"),
        externalMerchantId: stringOrNull(formData, "externalMerchantId"),
        orderPlatformId: String(formData.get("orderPlatformId") ?? ""),
        pollingEnabled: boolFromForm(formData, "pollingEnabled"),
        webhookEnabled: boolFromForm(formData, "webhookEnabled"),
      });
      revalidatePath("/admin/integrations/delivery");
      return { status: "success", message: "Integracao salva com sucesso." };
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel salvar a integracao.",
      };
    }
  }

  async function update(_state: OperationState, formData: FormData): Promise<OperationState> {
    "use server";

    try {
      await updateDeliveryIntegration(await getAdminToken(), String(formData.get("id") ?? ""), {
        displayName: String(formData.get("displayName") ?? "iFood"),
        externalMerchantId: stringOrNull(formData, "externalMerchantId"),
        pollingEnabled: boolFromForm(formData, "pollingEnabled"),
        webhookEnabled: boolFromForm(formData, "webhookEnabled"),
      });
      revalidatePath("/admin/integrations/delivery");
      return { status: "success", message: "Integracao atualizada." };
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel atualizar.",
      };
    }
  }

  async function credentials(_state: OperationState, formData: FormData): Promise<OperationState> {
    "use server";

    try {
      await saveDeliveryIntegrationCredentials(
        await getAdminToken(),
        String(formData.get("id") ?? ""),
        {
          clientId: String(formData.get("clientId") ?? ""),
          clientSecret: String(formData.get("clientSecret") ?? ""),
          authorizationCode: stringOrNull(formData, "authorizationCode"),
          authorizationCodeVerifier: stringOrNull(formData, "authorizationCodeVerifier"),
          refreshToken: stringOrNull(formData, "refreshToken"),
        }
      );
      revalidatePath("/admin/integrations/delivery");
      return { status: "success", message: "Credenciais salvas." };
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel salvar credenciais.",
      };
    }
  }

  async function authorizationCode(
    _state: OperationState,
    formData: FormData
  ): Promise<
    OperationState & {
      data?: {
        userCode: string;
        authorizationCodeVerifier: string;
        verificationUrl: string | null;
        verificationUrlComplete: string | null;
        expiresIn: number | null;
      };
    }
  > {
    "use server";

    try {
      const data = await requestDeliveryIntegrationAuthorizationCode(
        await getAdminToken(),
        String(formData.get("id") ?? ""),
        {
          clientId: String(formData.get("clientId") ?? ""),
          clientSecret: String(formData.get("clientSecret") ?? ""),
        }
      );
      return {
        status: "success",
        message: "Codigo iFood gerado. Autorize no portal e depois informe o authorization code.",
        data,
      };
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel gerar o codigo iFood.",
      };
    }
  }

  async function validate(_state: OperationState, formData: FormData): Promise<OperationState> {
    "use server";

    try {
      const result = await validateDeliveryIntegration(
        await getAdminToken(),
        String(formData.get("id") ?? "")
      );
      revalidatePath("/admin/integrations/delivery");
      return {
        status: result.valid ? "success" : "error",
        message: result.valid ? "Integracao validada." : "Validacao encontrou pendencias.",
      };
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel validar.",
      };
    }
  }

  async function activate(_state: OperationState, formData: FormData): Promise<OperationState> {
    "use server";

    try {
      await activateDeliveryIntegration(await getAdminToken(), String(formData.get("id") ?? ""));
      revalidatePath("/admin/integrations/delivery");
      return { status: "success", message: "Integracao ativada." };
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel ativar.",
      };
    }
  }

  async function pause(_state: OperationState, formData: FormData): Promise<OperationState> {
    "use server";

    try {
      await pauseDeliveryIntegration(await getAdminToken(), String(formData.get("id") ?? ""));
      revalidatePath("/admin/integrations/delivery");
      return { status: "success", message: "Integracao pausada." };
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel pausar.",
      };
    }
  }

  return (
    <DeliveryIntegrationsClient
      activateAction={activate}
      createAction={create}
      authorizationCodeAction={authorizationCode}
      credentialAction={credentials}
      integrations={integrations}
      healthByIntegrationId={healthByIntegrationId}
      orderPlatforms={orderPlatforms}
      pauseAction={pause}
      updateAction={update}
      validateAction={validate}
    />
  );
}
