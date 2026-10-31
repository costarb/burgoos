import React from "react";
import {
  getAdminToken,
  getFiscalConfiguration,
  getFiscalProfileAssignments,
  getMissingFiscalProfiles,
  listFiscalDocuments,
  listFiscalProfiles,
  listUnissuedSales,
} from "../../../lib/api";
import {
  assignFiscalProfilesAction,
  cancelFiscalDocumentAction,
  deleteFiscalProfileAction,
  emitSaleFiscalDocumentAction,
  disconnectBlingAction,
  loadBlingOptionsAction,
  loadFiscalDocumentsAction,
  loadUnissuedSalesAction,
  refreshFiscalConfigurationAction,
  reloadFiscalProfilesAction,
  reprocessFiscalDocumentAction,
  saveBlingSettingsAction,
  saveFiscalConfigurationAction,
  saveFiscalProfileAction,
  startBlingAuthorizationAction,
  syncFiscalDocumentAction,
} from "./actions";
import { FiscalClient, type FiscalTab } from "./fiscal-client";

export const dynamic = "force-dynamic";

const TABS: FiscalTab[] = ["configuracao", "perfis", "vendas", "notas", "pendencias"];

export default async function FiscalPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const token = await getAdminToken();
  const requestedTab = typeof searchParams?.tab === "string" ? searchParams.tab : "";
  const bling = searchParams?.bling === "connected" ? "connected" : searchParams?.bling === "error" ? "error" : null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const [configuration, profiles, missing, assignments, pending, documents, unissued] = await Promise.all([
    getFiscalConfiguration(token),
    listFiscalProfiles(token),
    getMissingFiscalProfiles(token),
    getFiscalProfileAssignments(token),
    listFiscalDocuments(token, { pendingOnly: true, pageSize: 25 }),
    listFiscalDocuments(token, { pageSize: 25 }),
    listUnissuedSales(token, today),
  ]);
  const initialTab: FiscalTab = TABS.includes(requestedTab as FiscalTab)
    ? (requestedTab as FiscalTab)
    : pending.total > 0 && configuration.enabled
      ? "pendencias"
      : unissued.length > 0 && configuration.enabled
        ? "vendas"
        : "configuracao";

  return (
    <FiscalClient
      assignments={assignments}
      blingResult={bling}
      configuration={configuration}
      configurationActions={{
        saveConfiguration: saveFiscalConfigurationAction,
        startBlingAuthorization: startBlingAuthorizationAction,
        loadBlingOptions: loadBlingOptionsAction,
        saveBlingSettings: saveBlingSettingsAction,
        disconnectBling: disconnectBlingAction,
        refreshConfiguration: refreshFiscalConfigurationAction,
      }}
      documentActions={{
        loadDocuments: loadFiscalDocumentsAction,
        reprocess: reprocessFiscalDocumentAction,
        cancel: cancelFiscalDocumentAction,
        sync: syncFiscalDocumentAction,
      }}
      documents={documents}
      initialTab={initialTab}
      missing={missing}
      pending={pending}
      profileActions={{
        saveProfile: saveFiscalProfileAction,
        deleteProfile: deleteFiscalProfileAction,
        reloadProfiles: reloadFiscalProfilesAction,
        assignProfiles: assignFiscalProfilesAction,
      }}
      profiles={profiles}
      today={today}
      unissued={unissued}
      unissuedActions={{ loadUnissued: loadUnissuedSalesAction, emitSale: emitSaleFiscalDocumentAction }}
    />
  );
}
