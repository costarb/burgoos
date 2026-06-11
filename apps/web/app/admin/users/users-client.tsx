"use client";

import type { AccessUserDetail } from "@burgoos/types";
import type { AccessUsersOptions } from "../../../lib/api";
import { useEffect, useMemo, useState } from "react";
import { readAuthSession } from "../../../lib/auth-client";
import { FirstAccessAction } from "./first-access-action";
import { UserForm } from "./user-form";
import { UserStatusDialog } from "./user-status-dialog";

interface UsersClientProps {
  token: string;
  users: AccessUserDetail[];
  options: AccessUsersOptions;
}

export function UsersClient({ token, users, options }: UsersClientProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [isMasterActor, setIsMasterActor] = useState(false);

  useEffect(() => {
    const session = readAuthSession();
    setIsMasterActor(Boolean(session?.user.isMaster));
  }, []);
  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !normalizedSearch ||
        user.name.toLowerCase().includes(normalizedSearch) ||
        user.email.toLowerCase().includes(normalizedSearch);
      const matchesStatus = status === "ALL" || user.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [search, status, users]);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <section className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-tomato">Acessos</p>
            <h1 className="mt-1 text-3xl font-semibold">Usuarios</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Cadastre usuarios, defina o perfil e vincule cada acesso a loja correta.
            </p>
          </div>
        </div>

        <section className="mt-8 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold">Novo usuario</h2>
          <UserForm mode="create" options={options} token={token} />
        </section>

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-base font-semibold">Usuarios cadastrados</h2>
            <div className="flex flex-wrap gap-2">
              <input
                className="h-10 rounded-md border border-slate-200 px-3 text-sm"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar usuario"
                type="search"
                value={search}
              />
              <select
                className="h-10 rounded-md border border-slate-200 px-3 text-sm"
                onChange={(event) => setStatus(event.target.value)}
                value={status}
              >
                <option value="ALL">Todos</option>
                <option value="INVITED">Convidado</option>
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
                <option value="LOCKED">Bloqueado</option>
              </select>
            </div>
          </div>
          <div className="mt-3 grid gap-3">
            {filteredUsers.map((user) => (
              <article
                className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
                key={user.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{user.name}</h3>
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium">
                        {user.status}
                      </span>
                      {user.isMaster ? (
                        <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
                          Master
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{user.email}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {(user.assignments ?? []).length
                        ? (user.assignments ?? [])
                            .map(
                              (assignment) =>
                                `${assignment.store.name} / ${assignment.profile.name}`
                            )
                            .join(", ")
                        : "Sem loja vinculada"}
                    </p>
                  </div>
                  {isMasterActor || !user.isMaster ? (
                    <div className="grid gap-2">
                      <UserStatusDialog token={token} user={user} />
                      <FirstAccessAction token={token} user={user} />
                    </div>
                  ) : null}
                </div>
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <UserForm mode="edit" options={options} token={token} user={user} />
                </div>
              </article>
            ))}
            {filteredUsers.length === 0 ? (
              <p className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-500">
                Nenhum usuario cadastrado.
              </p>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}
