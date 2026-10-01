import React from "react";
import type {
  CreateMcpTokenPayload,
  CreatedMcpToken,
  McpConfiguration,
  McpConfigurationPayload,
  McpToken,
  McpUsagePage,
  McpUsageQuery,
  OperationState,
} from "@rrfive/types";
import { revalidatePath } from "next/cache";
import {
  createMcpToken,
  getAdminToken,
  getMcpConfiguration,
  getMcpUsage,
  listMcpTokens,
  revokeMcpToken,
  updateMcpConfiguration,
} from "../../../../lib/api";
import type { McpActionState } from "./mcp-action-state";
import { McpSettingsClient } from "./mcp-settings-client";

export const dynamic = "force-dynamic";

function failure(error: unknown, fallback: string): OperationState {
  return { status: "error", message: error instanceof Error ? error.message : fallback };
}

export default async function McpSettingsPage() {
  const token = await getAdminToken();
  const [configuration, tokens, usage] = await Promise.all([
    getMcpConfiguration(token),
    listMcpTokens(token),
    getMcpUsage(token, { pageSize: 25 }),
  ]);

  async function saveConfiguration(
    payload: McpConfigurationPayload
  ): Promise<McpActionState<McpConfiguration>> {
    "use server";

    try {
      const data = await updateMcpConfiguration(await getAdminToken(), payload);
      revalidatePath("/admin/settings/mcp");
      return {
        status: "success",
        message: payload.enabled ? "Configuracao do MCP salva." : "MCP desabilitado para a loja.",
        data,
      };
    } catch (error) {
      return failure(error, "Nao foi possivel salvar a configuracao do MCP.");
    }
  }

  async function createToken(
    payload: CreateMcpTokenPayload
  ): Promise<McpActionState<CreatedMcpToken>> {
    "use server";

    try {
      const data = await createMcpToken(await getAdminToken(), payload);
      revalidatePath("/admin/settings/mcp");
      return { status: "success", message: "Token gerado.", data };
    } catch (error) {
      return failure(error, "Nao foi possivel gerar o token.");
    }
  }

  async function revokeToken(id: string): Promise<McpActionState<McpToken>> {
    "use server";

    try {
      const data = await revokeMcpToken(await getAdminToken(), id);
      revalidatePath("/admin/settings/mcp");
      return { status: "success", message: "Token revogado.", data };
    } catch (error) {
      return failure(error, "Nao foi possivel revogar o token.");
    }
  }

  async function loadUsage(query: McpUsageQuery): Promise<McpActionState<McpUsagePage>> {
    "use server";

    try {
      const data = await getMcpUsage(await getAdminToken(), query);
      return { status: "success", message: "Uso carregado.", data };
    } catch (error) {
      return failure(error, "Nao foi possivel carregar o uso do MCP.");
    }
  }

  return (
    <McpSettingsClient
      configuration={configuration}
      createTokenAction={createToken}
      loadUsageAction={loadUsage}
      revokeTokenAction={revokeToken}
      saveConfigurationAction={saveConfiguration}
      tokens={tokens}
      usage={usage}
    />
  );
}
