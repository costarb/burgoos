import React from "react";
import type { StoreProfileInput } from "@rrfive/types";
import { revalidatePath } from "next/cache";
import { getAdminToken, getStoreProfile, updateStoreProfile } from "../../../../lib/api";
import { StoreProfileClient, type StoreProfileActionState } from "./store-profile-client";

export const dynamic = "force-dynamic";

export default async function StoreProfilePage() {
  const store = await getStoreProfile(await getAdminToken());

  async function save(payload: StoreProfileInput): Promise<StoreProfileActionState> {
    "use server";

    try {
      const data = await updateStoreProfile(await getAdminToken(), payload);
      revalidatePath("/admin/settings/store");
      revalidatePath("/admin/fiscal");
      return { status: "success", message: "Dados da loja salvos.", data };
    } catch (error) {
      return { status: "error", message: error instanceof Error ? error.message : "Nao foi possivel salvar os dados da loja." };
    }
  }

  return <StoreProfileClient saveAction={save} store={store} />;
}
