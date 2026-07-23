"use client";

import React, { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  CreateStoreInput,
  OperationState,
  StoreAddress,
  StoreDetail,
  StoreOpenMode,
  StoreSocialLinks,
  StoreSummary,
  UpdateStoreInput,
} from "@burgoos/types";
import { Pencil, Plus, Power, Search, X } from "lucide-react";
import { OperationFeedback } from "../../../components/admin/operation-feedback";
import {
  createPlatformStore,
  getPlatformStore,
  listPlatformStores,
  updatePlatformStore,
} from "../../../lib/api";

interface StoreMaintenanceClientProps {
  token: string;
  initialStores: StoreSummary[];
  initialFilters: StoreFilters;
}

interface StoreFilters {
  search: string;
  active: string;
}

type StoreDialogMode = "create" | "edit";

const emptyFilters: StoreFilters = {
  search: "",
  active: "",
};

const emptyForm: StoreFormState = {
  name: "",
  slug: "",
  publicDomain: "",
  phone: "",
  active: true,
  openMode: "FORCE_CLOSED",
  operatingHours: "{}",
  address: {
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    postalCode: "",
  },
  socialLinks: {
    instagram: "",
    facebook: "",
    whatsapp: "",
    website: "",
  },
  ownerName: "",
  ownerEmail: "",
  temporaryPassword: "",
};

export function StoreMaintenanceClient({
  token,
  initialStores,
  initialFilters,
}: StoreMaintenanceClientProps) {
  const [stores, setStores] = useState(initialStores);
  const [filters, setFilters] = useState<StoreFilters>({
    search: initialFilters.search ?? "",
    active: initialFilters.active ?? "",
  });
  const [dialog, setDialog] = useState<{ mode: StoreDialogMode; store?: StoreDetail } | null>(null);
  const [operation, setOperation] = useState<OperationState>({ status: "idle" });
  const [busy, setBusy] = useState(false);

  const summary = useMemo(
    () => ({
      total: stores.length,
      active: stores.filter((store) => store.active).length,
      inactive: stores.filter((store) => !store.active).length,
    }),
    [stores]
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
    setStores(await listPlatformStores(token, nextFilters));
  }

  async function applyFilters() {
    await run("Aplicando filtros de lojas.", async () => {
      await refresh(filters);
    });
  }

  async function clearFilters() {
    setFilters(emptyFilters);
    await run("Limpando filtros de lojas.", async () => {
      await refresh(emptyFilters);
    });
  }

  async function openEdit(storeId: string) {
    await run("Carregando dados da loja.", async () => {
      const store = await getPlatformStore(token, storeId);
      setDialog({ mode: "edit", store });
    });
  }

  async function create(payload: CreateStoreInput) {
    await run("Criando loja.", async () => {
      await createPlatformStore(token, payload);
      await refresh();
      setDialog(null);
    });
  }

  async function update(storeId: string, payload: UpdateStoreInput) {
    await run("Salvando loja.", async () => {
      await updatePlatformStore(token, storeId, payload);
      await refresh();
      setDialog(null);
    });
  }

  async function toggleActive(store: StoreSummary) {
    await run(
      store.active ? "Desativando loja." : "Ativando loja.",
      async () => {
        await updatePlatformStore(token, store.id, { active: !store.active });
        await refresh();
      },
      store.active ? "Loja desativada." : "Loja ativada."
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 text-slate-900">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase text-tomato">Plataforma</p>
          <h1 className="mt-1 text-3xl font-semibold">Lojas</h1>
          <p className="mt-2 text-sm text-slate-500">
            Consulte, crie e mantenha lojas da plataforma.
          </p>
        </div>
        <button
          className="inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={busy}
          onClick={() => setDialog({ mode: "create" })}
          type="button"
        >
          <Plus className="h-4 w-4" />
          Nova loja
        </button>
      </div>

      <OperationFeedback
        className="mt-4"
        onDismiss={() => setOperation({ status: "idle" })}
        state={operation}
      />

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard label="Listadas" value={summary.total} />
        <MetricCard label="Ativas" value={summary.active} tone="success" />
        <MetricCard label="Inativas" value={summary.inactive} tone="muted" />
      </section>

      <section className="mt-6 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Consulta</h2>
          <p className="text-sm text-slate-500">Filtre por nome, slug, telefone ou status.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_180px_auto_auto]">
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            onChange={(event) =>
              setFilters((current) => ({ ...current, search: event.target.value }))
            }
            placeholder="Nome, slug ou telefone"
            value={filters.search}
          />
          <select
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            onChange={(event) =>
              setFilters((current) => ({ ...current, active: event.target.value }))
            }
            value={filters.active}
          >
            <option value="">Todos os status</option>
            <option value="true">Ativas</option>
            <option value="false">Inativas</option>
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
        <div className="hidden grid-cols-[1.35fr_1fr_1fr_0.7fr_0.8fr_0.8fr_auto] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500 lg:grid">
          <span>Loja</span>
          <span>Slug</span>
          <span>Contato</span>
          <span>Status</span>
          <span>Operacao</span>
          <span>Pronta</span>
          <span>Acoes</span>
        </div>
        {stores.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">Nenhuma loja encontrada.</p>
        ) : (
          stores.map((store) => (
            <article
              className="grid gap-3 border-b border-slate-100 px-4 py-4 last:border-b-0 lg:grid-cols-[1.35fr_1fr_1fr_0.7fr_0.8fr_0.8fr_auto] lg:items-center"
              key={store.id}
            >
              <div>
                <p className="font-semibold">{store.name}</p>
                <p className="text-xs text-slate-500">
                  {[store.city, store.state].filter(Boolean).join(" / ") || "Sem cidade"}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">/{store.slug}</p>
                <p className="text-xs text-slate-500">{store.publicDomain ?? "Sem dominio"}</p>
              </div>
              <p className="text-sm text-slate-600">{store.phone ?? "-"}</p>
              <StoreBadge tone={store.active ? "success" : "muted"}>
                {store.active ? "Ativa" : "Inativa"}
              </StoreBadge>
              <StoreBadge tone={store.isOpen ? "success" : "danger"}>
                {store.isOpen ? "Aberta" : "Fechada"}
              </StoreBadge>
              <StoreBadge tone={store.readiness?.ready ? "success" : "warning"}>
                {store.readiness?.ready ? "Sim" : "Nao"}
              </StoreBadge>
              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-60"
                  disabled={busy}
                  onClick={() => {
                    void openEdit(store.id);
                  }}
                  type="button"
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </button>
                <button
                  className={`inline-flex min-h-9 items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold disabled:opacity-60 ${
                    store.active
                      ? "border-red-200 text-red-700 hover:bg-red-50"
                      : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  }`}
                  disabled={busy}
                  onClick={() => {
                    void toggleActive(store);
                  }}
                  type="button"
                >
                  <Power className="h-4 w-4" />
                  {store.active ? "Desativar" : "Ativar"}
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      {dialog ? (
        <StoreEditorDialog
          busy={busy}
          mode={dialog.mode}
          onClose={() => setDialog(null)}
          onCreate={create}
          onUpdate={update}
          store={dialog.store}
        />
      ) : null}
    </main>
  );
}

function StoreEditorDialog({
  busy,
  mode,
  store,
  onClose,
  onCreate,
  onUpdate,
}: {
  busy: boolean;
  mode: StoreDialogMode;
  store?: StoreDetail;
  onClose: () => void;
  onCreate: (payload: CreateStoreInput) => Promise<void>;
  onUpdate: (storeId: string, payload: UpdateStoreInput) => Promise<void>;
}) {
  const [form, setForm] = useState<StoreFormState>(() => toFormState(store));
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setForm(toFormState(store));
    setFormError(null);
  }, [store]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    let operatingHours: Record<string, unknown>;

    try {
      operatingHours = JSON.parse(form.operatingHours || "{}") as Record<string, unknown>;
    } catch {
      setFormError("A agenda de horarios precisa estar em JSON valido.");
      return;
    }

    const basePayload = {
      name: form.name,
      slug: form.slug,
      publicDomain: form.publicDomain.trim(),
      phone: form.phone,
      address: cleanAddress(form.address),
      socialLinks: cleanSocialLinks(form.socialLinks),
      active: form.active,
      openMode: form.openMode,
      operatingHours,
    };

    if (mode === "create") {
      await onCreate({
        ...basePayload,
        owner: {
          name: form.ownerName,
          email: form.ownerEmail,
          temporaryPassword: form.temporaryPassword,
        },
      });
      return;
    }

    if (store) {
      await onUpdate(store.id, basePayload);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
      <section className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-md bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">
              {mode === "create" ? "Nova loja" : "Editar loja"}
            </h2>
            <p className="text-sm text-slate-500">
              {mode === "create"
                ? "Cadastre a loja e o responsavel inicial."
                : "Atualize dados publicos, status e operacao."}
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

        <form className="grid gap-5 p-5" onSubmit={submit}>
          {formError ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {formError}
            </p>
          ) : null}

          <section className="grid gap-4 md:grid-cols-3">
            <TextField
              label="Nome publico"
              onChange={(value) => setForm((current) => ({ ...current, name: value }))}
              required
              value={form.name}
            />
            <TextField
              label="Slug"
              onChange={(value) => setForm((current) => ({ ...current, slug: value }))}
              required
              value={form.slug}
            />
            <TextField
              label="Telefone"
              onChange={(value) => setForm((current) => ({ ...current, phone: value }))}
              required
              value={form.phone}
            />
          </section>

          <section className="grid gap-2 border-t border-slate-100 pt-4">
            <TextField
              label="Dominio publico"
              onChange={(value) => setForm((current) => ({ ...current, publicDomain: value }))}
              placeholder="dogaodomounjaro.com.br"
              value={form.publicDomain}
            />
            <p className="text-xs text-slate-500">
              Informe apenas o dominio. O cardapio ficara disponivel em /cardapio.
            </p>
            {form.publicDomain.trim() ? (
              <a
                className="text-sm font-semibold text-blue-700"
                href={`https://${form.publicDomain.trim().replace(/^www\./i, "")}/cardapio`}
                rel="noreferrer"
                target="_blank"
              >
                Abrir https://{form.publicDomain.trim().replace(/^www\./i, "")}/cardapio
              </a>
            ) : null}
          </section>

          <section className="grid gap-4 border-t border-slate-100 pt-4">
            <h3 className="font-semibold">Endereco publico</h3>
            <div className="grid gap-4 md:grid-cols-[2fr_120px_1fr]">
              <AddressField formKey="street" label="Logradouro" setForm={setForm} value={form} />
              <AddressField formKey="number" label="Numero" setForm={setForm} value={form} />
              <AddressField
                formKey="complement"
                label="Complemento"
                setForm={setForm}
                value={form}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-[1fr_1fr_80px_140px]">
              <AddressField formKey="neighborhood" label="Bairro" setForm={setForm} value={form} />
              <AddressField formKey="city" label="Cidade" setForm={setForm} value={form} />
              <AddressField
                formKey="state"
                label="UF"
                maxLength={2}
                setForm={setForm}
                value={form}
              />
              <AddressField formKey="postalCode" label="CEP" setForm={setForm} value={form} />
            </div>
          </section>

          <section className="grid gap-4 border-t border-slate-100 pt-4">
            <h3 className="font-semibold">Midias sociais</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <SocialField
                formKey="instagram"
                label="Instagram"
                placeholder="https://instagram.com/loja"
                setForm={setForm}
                value={form}
              />
              <SocialField
                formKey="facebook"
                label="Facebook"
                placeholder="https://facebook.com/loja"
                setForm={setForm}
                value={form}
              />
              <SocialField
                formKey="whatsapp"
                label="WhatsApp"
                placeholder="https://wa.me/..."
                setForm={setForm}
                value={form}
              />
              <SocialField
                formKey="website"
                label="Site"
                placeholder="https://..."
                setForm={setForm}
                value={form}
              />
            </div>
          </section>

          {mode === "create" ? (
            <section className="grid gap-4 border-t border-slate-100 pt-4 md:grid-cols-3">
              <TextField
                label="Responsavel"
                onChange={(value) => setForm((current) => ({ ...current, ownerName: value }))}
                required
                value={form.ownerName}
              />
              <TextField
                label="E-mail"
                onChange={(value) => setForm((current) => ({ ...current, ownerEmail: value }))}
                required
                type="email"
                value={form.ownerEmail}
              />
              <TextField
                label="Senha temporaria"
                onChange={(value) =>
                  setForm((current) => ({ ...current, temporaryPassword: value }))
                }
                required
                type="password"
                value={form.temporaryPassword}
              />
            </section>
          ) : null}

          <section className="grid gap-4 border-t border-slate-100 pt-4 md:grid-cols-[220px_1fr]">
            <div className="grid content-start gap-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  checked={form.active}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, active: event.target.checked }))
                  }
                  type="checkbox"
                />
                Loja ativa
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Abertura
                <select
                  className="rounded-md border border-slate-300 px-3 py-2"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      openMode: event.target.value as StoreOpenMode,
                    }))
                  }
                  value={form.openMode}
                >
                  <option value="SCHEDULE">Seguir agenda</option>
                  <option value="FORCE_OPEN">Forcar aberta</option>
                  <option value="FORCE_CLOSED">Forcar fechada</option>
                </select>
              </label>
            </div>
            <label className="grid gap-1 text-sm font-medium">
              Agenda de horarios
              <textarea
                className="min-h-36 rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
                onChange={(event) =>
                  setForm((current) => ({ ...current, operatingHours: event.target.value }))
                }
                value={form.operatingHours}
              />
            </label>
          </section>

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
              {mode === "create" ? "Criar loja" : "Salvar alteracoes"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

interface StoreFormState {
  name: string;
  slug: string;
  publicDomain: string;
  phone: string;
  active: boolean;
  openMode: StoreOpenMode;
  operatingHours: string;
  address: Required<StoreAddress>;
  socialLinks: Required<StoreSocialLinks>;
  ownerName: string;
  ownerEmail: string;
  temporaryPassword: string;
}

function toFormState(store?: StoreDetail): StoreFormState {
  if (!store) {
    return emptyForm;
  }

  const address = store.address ?? {};
  const socialLinks = store.socialLinks ?? {};

  return {
    ...emptyForm,
    name: store.name,
    slug: store.slug,
    publicDomain: store.publicDomain ?? "",
    phone: store.phone,
    active: store.active,
    openMode: store.openMode,
    operatingHours: JSON.stringify(store.operatingHours ?? {}, null, 2),
    address: {
      street: address.street ?? "",
      number: address.number ?? "",
      complement: address.complement ?? "",
      neighborhood: address.neighborhood ?? "",
      city: address.city ?? "",
      state: address.state ?? "",
      postalCode: address.postalCode ?? "",
    },
    socialLinks: {
      instagram: socialLinks.instagram ?? "",
      facebook: socialLinks.facebook ?? "",
      whatsapp: socialLinks.whatsapp ?? "",
      website: socialLinks.website ?? "",
    },
  };
}

function cleanAddress(address: StoreFormState["address"]): StoreAddress {
  return {
    street: address.street.trim(),
    number: address.number.trim(),
    complement: address.complement.trim(),
    neighborhood: address.neighborhood.trim(),
    city: address.city.trim(),
    state: address.state.trim().toUpperCase(),
    postalCode: address.postalCode.trim(),
  };
}

function cleanSocialLinks(socialLinks: StoreFormState["socialLinks"]): StoreSocialLinks {
  return {
    instagram: socialLinks.instagram.trim(),
    facebook: socialLinks.facebook.trim(),
    whatsapp: socialLinks.whatsapp.trim(),
    website: socialLinks.website.trim(),
  };
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  maxLength?: number;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      <input
        className="rounded-md border border-slate-300 px-3 py-2"
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}

function AddressField({
  formKey,
  label,
  value,
  setForm,
  maxLength,
}: {
  formKey: keyof StoreFormState["address"];
  label: string;
  value: StoreFormState;
  setForm: React.Dispatch<React.SetStateAction<StoreFormState>>;
  maxLength?: number;
}) {
  return (
    <TextField
      label={label}
      maxLength={maxLength}
      onChange={(nextValue) =>
        setForm((current) => ({
          ...current,
          address: { ...current.address, [formKey]: nextValue },
        }))
      }
      value={value.address[formKey]}
    />
  );
}

function SocialField({
  formKey,
  label,
  value,
  setForm,
  placeholder,
}: {
  formKey: keyof StoreFormState["socialLinks"];
  label: string;
  value: StoreFormState;
  setForm: React.Dispatch<React.SetStateAction<StoreFormState>>;
  placeholder?: string;
}) {
  return (
    <TextField
      label={label}
      onChange={(nextValue) =>
        setForm((current) => ({
          ...current,
          socialLinks: { ...current.socialLinks, [formKey]: nextValue },
        }))
      }
      placeholder={placeholder}
      value={value.socialLinks[formKey]}
    />
  );
}

function MetricCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "success" | "muted";
}) {
  const classes = {
    neutral: "border-slate-200 bg-white",
    success: "border-emerald-100 bg-emerald-50",
    muted: "border-slate-200 bg-slate-50",
  }[tone];

  return (
    <div className={`rounded-md border p-4 ${classes}`}>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function StoreBadge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "success" | "danger" | "warning" | "muted";
}) {
  const classes = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    danger: "border-red-200 bg-red-50 text-red-700",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    muted: "border-slate-200 bg-slate-100 text-slate-600",
  }[tone];

  return (
    <span className={`w-fit rounded-md border px-2 py-1 text-xs font-semibold ${classes}`}>
      {children}
    </span>
  );
}
