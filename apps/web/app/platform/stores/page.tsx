import React from "react";
import { redirect } from "next/navigation";
import { getPlatformAdminToken, listPlatformStores } from "../../../lib/api";
import { StoreMaintenanceClient } from "./store-maintenance-client";

export const dynamic = "force-dynamic";

interface StoresPageProps {
  searchParams?: {
    search?: string;
    active?: string;
  };
}

export default async function StoresPage({ searchParams }: StoresPageProps) {
  const token = await getPlatformAdminToken();
  let stores;
  const search = searchParams?.search?.trim() ?? "";
  const active =
    searchParams?.active === "true" || searchParams?.active === "false" ? searchParams.active : "";

  try {
    stores = await listPlatformStores(token, { search, active });
  } catch (error) {
    if (isPlatformForbidden(error)) {
      redirect("/admin");
    }

    throw error;
  }

  return (
    <StoreMaintenanceClient
      initialFilters={{ active, search }}
      initialStores={stores}
      token={token}
    />
  );
}

function isPlatformForbidden(error: unknown): boolean {
  return error instanceof Error && error.message.includes("[403] /api/platform/stores");
}
