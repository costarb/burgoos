"use server";

import type {
  BlingConnectionOptions,
  BlingSettingsPayload,
  FiscalConfigurationPayload,
  FiscalConfigurationView,
  FiscalDocumentDetail,
  FiscalDocumentPage,
  FiscalIssuerPayload,
  FiscalMissingProfiles,
  FiscalProfileAssignmentsPayload,
  FiscalProfilePayload,
  FiscalProfileView,
} from "@rrfive/types";
import { revalidatePath } from "next/cache";
import {
  assignFiscalProfiles,
  cancelFiscalDocument,
  createFiscalProfile,
  deleteFiscalProfile,
  disconnectBling,
  emitFiscalDocument,
  getAdminToken,
  getBlingConnectionOptions,
  getFiscalConfiguration,
  getMissingFiscalProfiles,
  listFiscalDocuments,
  listFiscalProfiles,
  reprocessFiscalDocument,
  startBlingAuthorization,
  syncFiscalDocument,
  updateBlingSettings,
  updateFiscalConfiguration,
  updateFiscalIssuer,
  updateFiscalProfile,
  type FiscalDocumentQuery,
} from "../../../lib/api";
import { errorMessage, type FiscalActionState } from "./fiscal-labels";

async function run<T>(operation: (token: string) => Promise<T>, success: string, fallback: string): Promise<FiscalActionState<T>> {
  try {
    const data = await operation(await getAdminToken());
    revalidatePath("/admin/fiscal");
    return { status: "success", message: success, data };
  } catch (error) {
    return { status: "error", message: errorMessage(error, fallback) };
  }
}

export async function saveFiscalConfigurationAction(payload: FiscalConfigurationPayload) {
  return run<FiscalConfigurationView>(
    (token) => updateFiscalConfiguration(token, payload),
    payload.enabled ? "Configuracao fiscal salva." : "Configuracao salva (emissao desativada).",
    "Nao foi possivel salvar a configuracao fiscal."
  );
}

export async function saveFiscalIssuerAction(payload: FiscalIssuerPayload) {
  return run<FiscalConfigurationView>((token) => updateFiscalIssuer(token, payload), "Dados do emitente salvos.", "Nao foi possivel salvar o emitente.");
}

export async function refreshFiscalConfigurationAction() {
  return run<FiscalConfigurationView>((token) => getFiscalConfiguration(token), "Configuracao atualizada.", "Nao foi possivel carregar a configuracao.");
}

export async function startBlingAuthorizationAction() {
  return run((token) => startBlingAuthorization(token), "Redirecionando para o Bling.", "Nao foi possivel iniciar a conexao com o Bling.");
}

export async function loadBlingOptionsAction() {
  return run<BlingConnectionOptions>((token) => getBlingConnectionOptions(token), "Opcoes do Bling carregadas.", "Nao foi possivel ler as opcoes do Bling.");
}

export async function saveBlingSettingsAction(payload: BlingSettingsPayload) {
  return run((token) => updateBlingSettings(token, payload), "Configuracao do Bling salva.", "Nao foi possivel salvar a configuracao do Bling.");
}

export async function disconnectBlingAction() {
  return run((token) => disconnectBling(token), "Conta Bling desconectada.", "Nao foi possivel desconectar o Bling.");
}

export async function saveFiscalProfileAction(id: string | null, payload: FiscalProfilePayload) {
  return run<FiscalProfileView>(
    (token) => (id ? updateFiscalProfile(token, id, payload) : createFiscalProfile(token, payload)),
    id ? "Perfil fiscal atualizado." : "Perfil fiscal criado.",
    "Nao foi possivel salvar o perfil fiscal."
  );
}

export async function deleteFiscalProfileAction(id: string) {
  return run((token) => deleteFiscalProfile(token, id), "Perfil fiscal excluido.", "Nao foi possivel excluir o perfil fiscal.");
}

export async function reloadFiscalProfilesAction() {
  return run<{ profiles: FiscalProfileView[]; missing: FiscalMissingProfiles }>(
    async (token) => ({ profiles: await listFiscalProfiles(token), missing: await getMissingFiscalProfiles(token) }),
    "Perfis atualizados.",
    "Nao foi possivel carregar os perfis."
  );
}

export async function assignFiscalProfilesAction(payload: FiscalProfileAssignmentsPayload) {
  return run((token) => assignFiscalProfiles(token, payload), "Atribuicao salva.", "Nao foi possivel salvar a atribuicao.");
}

export async function loadFiscalDocumentsAction(query: FiscalDocumentQuery) {
  return run<FiscalDocumentPage>((token) => listFiscalDocuments(token, query), "Notas carregadas.", "Nao foi possivel carregar as notas.");
}

export async function reprocessFiscalDocumentAction(id: string, confirmRetroactive = false) {
  return run<FiscalDocumentDetail>(
    (token) => reprocessFiscalDocument(token, id, confirmRetroactive),
    "Reprocessamento solicitado.",
    "Nao foi possivel reprocessar a nota."
  );
}

export async function cancelFiscalDocumentAction(id: string, reason: string) {
  return run<FiscalDocumentDetail>((token) => cancelFiscalDocument(token, id, reason), "Cancelamento solicitado.", "Nao foi possivel cancelar a nota.");
}

export async function syncFiscalDocumentAction(id: string) {
  return run<FiscalDocumentDetail>((token) => syncFiscalDocument(token, id), "Situacao consultada no provedor.", "Nao foi possivel consultar o provedor.");
}

export async function emitFiscalDocumentAction(orderId: string, confirmRetroactive = false, consumerDocument?: string | null) {
  return run<FiscalDocumentDetail>(
    (token) => emitFiscalDocument(token, { target: { type: "ORDER", id: orderId }, confirmRetroactive, consumerDocument }),
    "Emissao da NFC-e solicitada.",
    "Nao foi possivel emitir a NFC-e."
  );
}
