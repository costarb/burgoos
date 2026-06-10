"use client";

import type {
  AccessPermissionGroup,
  AccessProfileDetail,
  AccessStoreSummary,
} from "@burgoos/types";
import { FormEvent, useMemo, useState } from "react";
import { createAccessProfile, updateAccessProfile } from "../../../lib/api";

interface AccessProfileFormProps {
  token: string;
  mode: "create" | "edit";
  profile?: AccessProfileDetail;
  permissions: AccessPermissionGroup[];
  stores: AccessStoreSummary[];
}

export function AccessProfileForm({
  token,
  mode,
  profile,
  permissions,
  stores,
}: AccessProfileFormProps) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const selectedPermissions = useMemo(
    () => new Set(profile?.permissions.map((permission) => permission.key) ?? []),
    [profile]
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const scope = String(form.get("scope") ?? "STORE") as "GLOBAL" | "STORE";
    const permissionKeys = form.getAll("permissionKeys").map(String);
    const storeId = scope === "STORE" ? String(form.get("storeId") ?? "") : null;

    const payload = {
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? "") || null,
      scope,
      storeId,
      permissionKeys,
    };

    try {
      if (mode === "create") {
        await createAccessProfile(token, payload);
      } else if (profile) {
        await updateAccessProfile(token, profile.id, {
          name: payload.name,
          description: payload.description,
          permissionKeys,
        });
      }

      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel salvar o perfil.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="mt-3 grid gap-4" onSubmit={submit}>
      <div className="grid gap-3 md:grid-cols-4">
        <input
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          defaultValue={profile?.name ?? ""}
          maxLength={80}
          name="name"
          placeholder="Nome do perfil"
          required
        />
        <select
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          defaultValue={profile?.scope ?? "STORE"}
          disabled={mode === "edit"}
          name="scope"
        >
          <option value="STORE">Por loja</option>
          <option value="GLOBAL">Global</option>
        </select>
        <select
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          defaultValue={profile?.storeId ?? stores[0]?.id ?? ""}
          disabled={mode === "edit"}
          name="storeId"
        >
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </select>
        <button
          className="min-h-10 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "Salvando..." : mode === "create" ? "Criar perfil" : "Salvar perfil"}
        </button>
      </div>
      <textarea
        className="min-h-20 rounded-md border border-slate-200 px-3 py-2 text-sm"
        defaultValue={profile?.description ?? ""}
        maxLength={240}
        name="description"
        placeholder="Descricao"
      />

      <div className="grid gap-3 lg:grid-cols-2">
        {permissions.map((group) => (
          <fieldset className="rounded-md border border-slate-200 p-3" key={group.area}>
            <legend className="px-1 text-sm font-semibold">{group.area}</legend>
            <div className="mt-2 grid gap-3">
              {group.screens.map((screen) => (
                <div key={screen.screen}>
                  <p className="text-xs font-semibold uppercase text-slate-500">{screen.screen}</p>
                  <div className="mt-2 grid gap-2">
                    {screen.permissions.map((permission) => (
                      <label className="flex items-start gap-2 text-sm" key={permission.key}>
                        <input
                          className="mt-1"
                          defaultChecked={selectedPermissions.has(permission.key)}
                          name="permissionKeys"
                          type="checkbox"
                          value={permission.key}
                        />
                        <span>
                          <span className="font-medium">{permission.description}</span>
                          {permission.sensitive ? (
                            <span className="ml-2 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                              sensivel
                            </span>
                          ) : null}
                          <span className="block text-xs text-slate-500">{permission.key}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      {message ? <p className="text-sm text-red-700">{message}</p> : null}
    </form>
  );
}
