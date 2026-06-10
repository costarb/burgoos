"use client";

import type {
  AccessPermissionGroup,
  AccessProfileDetail,
  AccessStoreSummary,
} from "@burgoos/types";
import { useMemo, useState } from "react";
import { AccessProfileActions } from "./access-profile-actions";
import { AccessProfileForm } from "./access-profile-form";

interface AccessProfilesClientProps {
  token: string;
  profiles: AccessProfileDetail[];
  permissions: AccessPermissionGroup[];
  stores: AccessStoreSummary[];
}

export function AccessProfilesClient({
  token,
  profiles,
  permissions,
  stores,
}: AccessProfilesClientProps) {
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("ALL");
  const filteredProfiles = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return profiles.filter((profile) => {
      const matchesSearch =
        !normalizedSearch || profile.name.toLowerCase().includes(normalizedSearch);
      const matchesScope = scope === "ALL" || profile.scope === scope;

      return matchesSearch && matchesScope;
    });
  }, [profiles, scope, search]);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <section className="mx-auto max-w-7xl">
        <div>
          <p className="text-sm font-semibold uppercase text-tomato">Acessos</p>
          <h1 className="mt-1 text-3xl font-semibold">Perfis de acesso</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Organize permissoes por perfil para liberar telas e acoes de forma consistente.
          </p>
        </div>

        <section className="mt-8 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold">Novo perfil</h2>
          <AccessProfileForm
            mode="create"
            permissions={permissions}
            stores={stores}
            token={token}
          />
        </section>

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-base font-semibold">Perfis cadastrados</h2>
            <div className="flex flex-wrap gap-2">
              <input
                className="h-10 rounded-md border border-slate-200 px-3 text-sm"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar perfil"
                type="search"
                value={search}
              />
              <select
                className="h-10 rounded-md border border-slate-200 px-3 text-sm"
                onChange={(event) => setScope(event.target.value)}
                value={scope}
              >
                <option value="ALL">Todos</option>
                <option value="GLOBAL">Globais</option>
                <option value="STORE">Por loja</option>
              </select>
            </div>
          </div>

          <div className="mt-3 grid gap-3">
            {filteredProfiles.map((profile) => (
              <article
                className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
                key={profile.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{profile.name}</h3>
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium">
                        {profile.scope}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium">
                        {profile.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {profile.description ?? "Sem descricao"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {profile.permissions.length} permissoes vinculadas
                    </p>
                  </div>
                  <AccessProfileActions profile={profile} stores={stores} token={token} />
                </div>
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <AccessProfileForm
                    mode="edit"
                    permissions={permissions}
                    profile={profile}
                    stores={stores}
                    token={token}
                  />
                </div>
              </article>
            ))}
            {filteredProfiles.length === 0 ? (
              <p className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-500">
                Nenhum perfil encontrado.
              </p>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}
