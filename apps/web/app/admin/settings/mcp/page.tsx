import React from "react";
import type {
  CreateMcpTokenPayload,
  CreatedMcpToken,
  McpConfiguration,
  McpConfigurationPayload,
  McpToken,
  OperationState,
} from "@rrfive/types";
import { revalidatePath } from "next/cache";
import {
  createMcpToken,
  getAdminToken,
  getMcpConfiguration,
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
  const [configuration, tokens] = await Promise.all([
    getMcpConfiguration(token),
    listMcpTokens(token),
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

  return (
    <McpSettingsClient
      configuration={configuration}
      createTokenAction={createToken}
      revokeTokenAction={revokeToken}
      saveConfigurationAction={saveConfiguration}
      tokens={tokens}
    />
  );
}
