"use client";

import React, { FormEvent, useMemo, useState } from "react";
import type {
  CreatePlatformUserInput,
  OperationState,
  PlatformUserRole,
  PlatformUserSummary,
  UpdatePlatformUserInput,
} from "@burgoos/types";
import { Pencil, Plus, Power, Search, X } from "lucide-react";
import { OperationFeedback } from "../../../components/admin/operation-feedback";
import { createPlatformUser, listPlatformUsers, updatePlatformUser } from "../../../lib/api";

interface PlatformUsersClientProps {
  token: string;
  initialUsers: PlatformUserSummary[];
  initialFilters: PlatformUserFilters;
}

interface PlatformUserFilters {
  search: string;
  active: string;
  role: string;
}

interface PlatformUserFormState {
  name: string;
  email: string;
  role: PlatformUserRole;
  active: boolean;
  temporaryPassword: string;
}

type DialogState =
  | { mode: "create"; user?: undefined }
  | { mode: "edit"; user: PlatformUserSummary };

const emptyFilters: PlatformUserFilters = {
  search: "",
  active: "",
  role: "",
};

const emptyForm: PlatformUserFormState = {
  name: "",
  email: "",
  role: "SUPER_ADMIN",
  active: true,
  temporaryPassword: "",
};

const roleLabels: Record<PlatformUserRole, string> = {
  SUPER_ADMIN: "Super admin",
  SUPPORT: "Suporte",
};

export function PlatformUsersClient({
  token,
  initialUsers,
  initialFilters,
}: PlatformUsersClientProps) {
  const [users, setUsers] = useState(initialUsers);
  const [filters, setFilters] = useState<PlatformUserFilters>({
    search: initialFilters.search ?? "",
    active: initialFilters.active ?? "",
    role: initialFilters.role ?? "",
  });
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [operation, setOperation] = useState<OperationState>({ status: "idle" });
  const [busy, setBusy] = useState(false);

  const summary = useMemo(
    () => ({
      total: users.length,
      active: users.filter((user) => user.active).length,
      superAdmins: users.filter((user) => user.role === "SUPER_ADMIN" && user.active).length,
    }),
    [users]
  );

  async function run(message: string, action: () => Promise<void>, successMessage?: string) {
    if (busy) {
      return;
    }

    setBusy(true);
    setOperation({ status: "pending", message });

    try {
      await action();
      setOperation({
        status: "success",
        message: successMessage ?? "Operacao concluida com sucesso.",
      });
    } catch (error) {
      setOperation({
        status: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel concluir a operacao.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function refresh(nextFilters = filters) {
    setUsers(await listPlatformUsers(token, nextFilters));
  }

  async function applyFilters() {
    await run("Aplicando filtros de usuarios.", async () => {
      await refresh(filters);
    });
  }

  async function clearFilters() {
    setFilters(emptyFilters);
    await run("Limpando filtros de usuarios.", async () => {
      await refresh(emptyFilters);
    });
  }

  async function create(payload: CreatePlatformUserInput) {
    await run("Criando usuario de plataforma.", async () => {
      await createPlatformUser(token, payload);
      await refresh();
      setDialog(null);
    });
  }

  async function update(userId: string, payload: UpdatePlatformUserInput) {
    await run("Salvando usuario de plataforma.", async () => {
      await updatePlatformUser(token, userId, payload);
      await refresh();
      setDialog(null);
    });
  }

  async function toggleActive(user: PlatformUserSummary) {
    await run(
      user.active ? "Desativando usuario." : "Ativando usuario.",
      async () => {
        await updatePlatformUser(token, user.id, { active: !user.active });
        await refresh();
      },
      user.active ? "Usuario desativado." : "Usuario ativado."
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 text-slate-900">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase text-tomato">Plataforma</p>
          <h1 className="mt-1 text-3xl font-semibold">Admins da plataforma</h1>
          <p className="mt-2 text-sm text-slate-500">
            Consulte, crie e mantenha usuarios administrativos da plataforma.
          </p>
        </div>
        <button
          className="inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={busy}
          onClick={() => setDialog({ mode: "create" })}
          type="button"
        >
          <Plus className="h-4 w-4" />
          Novo admin
        </button>
      </div>

      <OperationFeedback
        className="mt-4"
        onDismiss={() => setOperation({ status: "idle" })}
        state={operation}
      />

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard label="Listados" value={summary.total} />
        <MetricCard label="Ativos" value={summary.active} tone="success" />
        <MetricCard label="Super admins ativos" value={summary.superAdmins} tone="warning" />
      </section>

      <section className="mt-6 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Consulta</h2>
          <p className="text-sm text-slate-500">Filtre por nome, e-mail, perfil ou status.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto_auto]">
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            onChange={(event) =>
              setFilters((current) => ({ ...current, search: event.target.value }))
            }
            placeholder="Nome ou e-mail"
            value={filters.search}
          />
          <select
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            onChange={(event) =>
              setFilters((current) => ({ ...current, role: event.target.value }))
            }
            value={filters.role}
          >
            <option value="">Todos os perfis</option>
            <option value="SUPER_ADMIN">Super admin</option>
            <option value="SUPPORT">Suporte</option>
          </select>
          <select
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            onChange={(event) =>
              setFilters((current) => ({ ...current, active: event.target.value }))
            }
            value={filters.active}
          >
            <option value="">Todos os status</option>
            <option value="true">Ativos</option>
            <option value="false">Inativos</option>
          </select>
          <button
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={busy}
            onClick={applyFilters}
            type="button"
          >
            <Search className="h-4 w-4" />
            Filtrar
          </button>
          <button
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-60"
            disabled={busy}
            onClick={clearFilters}
            type="button"
          >
            Limpar
          </button>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="hidden grid-cols-[1.3fr_1.3fr_0.8fr_0.7fr_auto] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500 lg:grid">
          <span>Usuario</span>
          <span>E-mail</span>
          <span>Perfil</span>
          <span>Status</span>
          <span>Acoes</span>
        </div>
        {users.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">Nenhum usuario encontrado.</p>
        ) : (
          users.map((user) => (
            <article
              className="grid gap-3 border-b border-slate-100 px-4 py-4 last:border-b-0 lg:grid-cols-[1.3fr_1.3fr_0.8fr_0.7fr_auto] lg:items-center"
              key={user.id}
            >
              <div>
                <p className="font-semibold">{user.name}</p>
                <p className="text-xs text-slate-500">
                  Atualizado em {formatDateTime(user.updatedAt)}
                </p>
              </div>
              <p className="text-sm text-slate-600">{user.email}</p>
              <PlatformBadge tone={user.role === "SUPER_ADMIN" ? "warning" : "muted"}>
                {roleLabels[user.role]}
              </PlatformBadge>
              <PlatformBadge tone={user.active ? "success" : "muted"}>
                {user.active ? "Ativo" : "Inativo"}
              </PlatformBadge>
              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-60"
                  disabled={busy}
                  onClick={() => setDialog({ mode: "edit", user })}
                  type="button"
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </button>
                <button
                  className={`inline-flex min-h-9 items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold disabled:opacity-60 ${
                    user.active
                      ? "border-red-200 text-red-700 hover:bg-red-50"
                      : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  }`}
                  disabled={busy}
                  onClick={() => {
                    void toggleActive(user);
                  }}
                  type="button"
                >
                  <Power className="h-4 w-4" />
                  {user.active ? "Desativar" : "Ativar"}
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      {dialog ? (
        <PlatformUserDialog
          busy={busy}
          dialog={dialog}
          onClose={() => setDialog(null)}
          onCreate={create}
          onUpdate={update}
        />
      ) : null}
    </main>
  );
}

function PlatformUserDialog({
  busy,
  dialog,
  onClose,
  onCreate,
  onUpdate,
}: {
  busy: boolean;
  dialog: DialogState;
  onClose: () => void;
  onCreate: (payload: CreatePlatformUserInput) => Promise<void>;
  onUpdate: (userId: string, payload: UpdatePlatformUserInput) => Promise<void>;
}) {
  const [form, setForm] = useState<PlatformUserFormState>(() => toFormState(dialog));
  const [formError, setFormError] = useState<string | null>(null);
  const isCreate = dialog.mode === "create";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (isCreate && form.temporaryPassword.trim().length < 6) {
      setFormError("Informe uma senha temporaria com pelo menos 6 caracteres.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      role: form.role,
      active: form.active,
      temporaryPassword: form.temporaryPassword.trim() || undefined,
    };

    if (isCreate) {
      await onCreate({
        ...payload,
        temporaryPassword: form.temporaryPassword.trim(),
      });
      return;
    }

    await onUpdate(dialog.user.id, payload);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
      <section className="w-full max-w-2xl rounded-md bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">
              {isCreate ? "Novo admin da plataforma" : "Editar admin da plataforma"}
            </h2>
            <p className="text-sm text-slate-500">
              {isCreate
                ? "Crie um acesso administrativo para operar a plataforma."
                : "Atualize dados, perfil, status ou defina uma nova senha temporaria."}
            </p>
          </div>
          <button
            aria-label="Fechar"
            className="rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="grid gap-4 p-5" onSubmit={submit}>
          {formError ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {formError}
            </p>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              label="Nome"
              onChange={(value) => setForm((current) => ({ ...current, name: value }))}
              required
              value={form.name}
            />
            <TextField
              label="E-mail"
              onChange={(value) => setForm((current) => ({ ...current, email: value }))}
              required
              type="email"
              value={form.email}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium">
              Perfil
              <select
                className="rounded-md border border-slate-300 px-3 py-2"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    role: event.target.value as PlatformUserRole,
                  }))
                }
                value={form.role}
              >
                <option value="SUPER_ADMIN">Super admin</option>
                <option value="SUPPORT">Suporte</option>
              </select>
            </label>
            <TextField
              label={isCreate ? "Senha temporaria" : "Nova senha temporaria"}
              onChange={(value) => setForm((current) => ({ ...current, temporaryPassword: value }))}
              required={isCreate}
              type="password"
              value={form.temporaryPassword}
            />
          </div>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              checked={form.active}
              onChange={(event) =>
                setForm((current) => ({ ...current, active: event.target.checked }))
              }
              type="checkbox"
            />
            Usuario ativo
          </label>

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-60"
              disabled={busy}
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              disabled={busy}
              type="submit"
            >
              {isCreate ? "Criar admin" : "Salvar alteracoes"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function toFormState(dialog: DialogState): PlatformUserFormState {
  if (dialog.mode === "create") {
    return emptyForm;
  }

  return {
    name: dialog.user.name,
    email: dialog.user.email,
    role: dialog.user.role,
    active: dialog.user.active,
    temporaryPassword: "",
  };
}

function TextField({
  label,
  value,
  onChange,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      <input
        className="rounded-md border border-slate-300 px-3 py-2"
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}

function MetricCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "success" | "warning";
}) {
  const classes = {
    neutral: "border-slate-200 bg-white",
    success: "border-emerald-100 bg-emerald-50",
    warning: "border-amber-100 bg-amber-50",
  }[tone];

  return (
    <div className={`rounded-md border p-4 ${classes}`}>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function PlatformBadge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "success" | "warning" | "muted";
}) {
  const classes = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    muted: "border-slate-200 bg-slate-100 text-slate-600",
  }[tone];

  return (
    <span className={`w-fit rounded-md border px-2 py-1 text-xs font-semibold ${classes}`}>
      {children}
    </span>
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
