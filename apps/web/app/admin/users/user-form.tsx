"use client";

import type { AccessUserDetail } from "@burgoos/types";
import type { AccessUsersOptions } from "../../../lib/api";
import { createAccessUser, updateAccessUser } from "../../../lib/api";
import { FormEvent, useMemo, useState } from "react";

interface UserFormProps {
  token: string;
  options: AccessUsersOptions;
  mode: "create" | "edit";
  user?: AccessUserDetail;
}

export function UserForm({ token, options, mode, user }: UserFormProps) {
  const firstAssignment = user?.assignments[0];
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const activeProfiles = useMemo(
    () => options.profiles.filter((profile) => profile.status === "ACTIVE"),
    [options.profiles]
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const storeId = String(form.get("storeId") ?? "");
    const profileId = String(form.get("profileId") ?? "");
    const isMaster = form.get("isMaster") === "on";

    const payload = {
      login: String(form.get("email") ?? ""),
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? "") || null,
      isMaster,
      assignments:
        storeId && profileId
          ? [
              {
                storeId,
                profileId,
                canManageStoreAccess: form.get("canManageStoreAccess") === "on",
                status: "ACTIVE" as const,
              },
            ]
          : [],
    };

    try {
      if (mode === "create") {
        await createAccessUser(token, payload);
      } else if (user) {
        await updateAccessUser(token, user.id, payload);
      }

      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel salvar o usuario.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="mt-3 grid gap-3 md:grid-cols-4" onSubmit={submit}>
      <input
        className="rounded-md border border-slate-200 px-3 py-2 text-sm"
        defaultValue={user?.name ?? ""}
        maxLength={120}
        name="name"
        placeholder="Nome"
        required
      />
      <input
        className="rounded-md border border-slate-200 px-3 py-2 text-sm"
        defaultValue={user?.email ?? ""}
        maxLength={160}
        name="email"
        placeholder="Email"
        required
        type="email"
      />
      <input
        className="rounded-md border border-slate-200 px-3 py-2 text-sm"
        defaultValue={user?.phone ?? ""}
        maxLength={40}
        name="phone"
        placeholder="Telefone"
      />
      <select
        className="rounded-md border border-slate-200 px-3 py-2 text-sm"
        defaultValue={firstAssignment?.store.id ?? options.stores[0]?.id ?? ""}
        name="storeId"
      >
        {options.stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.name}
          </option>
        ))}
      </select>
      <select
        className="rounded-md border border-slate-200 px-3 py-2 text-sm"
        defaultValue={firstAssignment?.profile.id ?? activeProfiles[0]?.id ?? ""}
        name="profileId"
      >
        {activeProfiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.name}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm">
        <input defaultChecked={user?.isMaster ?? false} name="isMaster" type="checkbox" />
        Master
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          defaultChecked={firstAssignment?.canManageStoreAccess ?? false}
          name="canManageStoreAccess"
          type="checkbox"
        />
        Admin da loja
      </label>
      <button
        className="min-h-10 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Salvando..." : mode === "create" ? "Criar usuario" : "Salvar usuario"}
      </button>
      {message ? <p className="text-sm text-red-700 md:col-span-4">{message}</p> : null}
    </form>
  );
}
