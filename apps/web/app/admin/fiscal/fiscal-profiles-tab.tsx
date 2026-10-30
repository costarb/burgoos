"use client";

import React, { useEffect, useMemo, useState } from "react";
import type {
  FiscalMissingProfiles,
  FiscalProfileAssignments,
  FiscalProfileAssignmentsPayload,
  FiscalProfilePayload,
  FiscalProfileView,
} from "@rrfive/types";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { FiscalActionState } from "./fiscal-labels";

export interface FiscalProfileActions {
  saveProfile: (id: string | null, payload: FiscalProfilePayload) => Promise<FiscalActionState<FiscalProfileView>>;
  deleteProfile: (id: string) => Promise<FiscalActionState<void>>;
  reloadProfiles: () => Promise<FiscalActionState<{ profiles: FiscalProfileView[]; missing: FiscalMissingProfiles }>>;
  assignProfiles: (payload: FiscalProfileAssignmentsPayload) => Promise<FiscalActionState<{ updated: number }>>;
}

interface Props {
  profiles: FiscalProfileView[];
  missing: FiscalMissingProfiles;
  assignments: FiscalProfileAssignments;
  actions: FiscalProfileActions;
  busy: boolean;
  run: <T>(action: () => Promise<FiscalActionState<T>>, onSuccess?: (data: T) => void) => Promise<void>;
}

const EMPTY_PROFILE: FiscalProfilePayload = { name: "", ncm: "", cfop: "5102", csosn: "102", origin: 0, commercialUnit: "UN", cest: null, benefitCode: null, active: true };
const CSOSN_OPTIONS = [
  ["102", "102 - Tributada sem permissao de credito"],
  ["103", "103 - Isencao do ICMS para faixa de receita"],
  ["300", "300 - Imune"],
  ["400", "400 - Nao tributada"],
  ["500", "500 - ICMS cobrado anteriormente por ST"],
  ["101", "101 - Tributada com permissao de credito"],
  ["900", "900 - Outros"],
];
const inputClass = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";
const cardClass = "rounded-md border border-slate-200 bg-white p-5 shadow-sm";

export function FiscalProfilesTab({ profiles: initialProfiles, missing: initialMissing, assignments, actions, busy, run }: Props) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [missing, setMissing] = useState(initialMissing);
  const [editing, setEditing] = useState<{ id: string | null; form: FiscalProfilePayload } | null>(null);
  const [categoryMap, setCategoryMap] = useState(() => toMap(assignments.categories));
  const [productMap, setProductMap] = useState(() => toMap(assignments.products));
  const [complementMap, setComplementMap] = useState(() => toMap(assignments.complements));
  const [showProducts, setShowProducts] = useState(false);

  useEffect(() => setProfiles(initialProfiles), [initialProfiles]);
  useEffect(() => setMissing(initialMissing), [initialMissing]);

  const activeProfiles = profiles.filter((profile) => profile.active);
  const missingCount = missing.products.length + missing.complements.length;
  const productsByCategory = useMemo(() => {
    const grouped = new Map<string, FiscalProfileAssignments["products"]>();
    for (const product of assignments.products) grouped.set(product.categoryId, [...(grouped.get(product.categoryId) ?? []), product]);
    return grouped;
  }, [assignments.products]);

  function reload() {
    return run(actions.reloadProfiles, (data) => {
      setProfiles(data.profiles);
      setMissing(data.missing);
    });
  }

  function saveAssignments() {
    const changed = <T extends { id: string; fiscalProfileId: string | null }>(items: T[], map: Record<string, string>) =>
      items
        .filter((item) => (item.fiscalProfileId ?? "") !== (map[item.id] ?? ""))
        .map((item) => ({ id: item.id, fiscalProfileId: map[item.id] || null }));
    const payload: FiscalProfileAssignmentsPayload = {
      categories: changed(assignments.categories, categoryMap),
      products: changed(assignments.products, productMap),
      complements: changed(assignments.complements, complementMap),
    };
    return run(() => actions.assignProfiles(payload), () => void reload());
  }

  const profileSelect = (value: string, onChange: (value: string) => void, label: string, emptyLabel: string) => (
    <select aria-label={label} className={inputClass} onChange={(event) => onChange(event.target.value)} value={value}>
      <option value="">{emptyLabel}</option>
      {activeProfiles.map((profile) => (
        <option key={profile.id} value={profile.id}>
          {profile.name} (NCM {profile.ncm}, CSOSN {profile.csosn})
        </option>
      ))}
    </select>
  );

  return (
    <div className="space-y-6">
      <section className={cardClass}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Perfis fiscais</h2>
            <p className="mt-1 text-sm text-slate-600">
              Defina NCM, CFOP e CSOSN uma vez e reutilize. A categoria define o padrao; produto e complemento podem ter perfil proprio.
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={busy}
            onClick={() => setEditing({ id: null, form: { ...EMPTY_PROFILE } })}
            type="button"
          >
            <Plus aria-hidden className="h-4 w-4" /> Novo perfil
          </button>
        </div>

        {editing ? (
          <form
            className="mt-4 grid gap-3 rounded-md bg-slate-50 p-4 sm:grid-cols-3"
            data-testid="fiscal-profile-form"
            onSubmit={(event) => {
              event.preventDefault();
              void run(
                () => actions.saveProfile(editing.id, editing.form),
                () => {
                  setEditing(null);
                  void reload();
                }
              );
            }}
          >
            <label className="text-sm sm:col-span-3">
              Nome
              <input className={inputClass} onChange={(event) => setEditing({ ...editing, form: { ...editing.form, name: event.target.value } })} required value={editing.form.name} />
            </label>
            <label className="text-sm">
              NCM
              <input className={inputClass} onChange={(event) => setEditing({ ...editing, form: { ...editing.form, ncm: event.target.value } })} placeholder="2106.90.90" required value={editing.form.ncm} />
            </label>
            <label className="text-sm">
              CFOP
              <input className={inputClass} onChange={(event) => setEditing({ ...editing, form: { ...editing.form, cfop: event.target.value } })} required value={editing.form.cfop} />
            </label>
            <label className="text-sm">
              CSOSN
              <select className={inputClass} onChange={(event) => setEditing({ ...editing, form: { ...editing.form, csosn: event.target.value } })} value={editing.form.csosn}>
                {CSOSN_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Origem
              <select className={inputClass} onChange={(event) => setEditing({ ...editing, form: { ...editing.form, origin: Number(event.target.value) } })} value={editing.form.origin}>
                <option value={0}>0 - Nacional</option>
                <option value={1}>1 - Estrangeira (importacao direta)</option>
                <option value={2}>2 - Estrangeira (mercado interno)</option>
              </select>
            </label>
            <label className="text-sm">
              Unidade
              <input className={inputClass} onChange={(event) => setEditing({ ...editing, form: { ...editing.form, commercialUnit: event.target.value } })} required value={editing.form.commercialUnit} />
            </label>
            <label className="text-sm">
              CEST {editing.form.csosn === "500" ? "(obrigatorio)" : "(opcional)"}
              <input className={inputClass} onChange={(event) => setEditing({ ...editing, form: { ...editing.form, cest: event.target.value || null } })} value={editing.form.cest ?? ""} />
            </label>
            <div className="flex gap-2 sm:col-span-3">
              <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} type="submit">
                Salvar perfil
              </button>
              <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold" onClick={() => setEditing(null)} type="button">
                Cancelar
              </button>
            </div>
          </form>
        ) : null}

        <table className="mt-4 w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2">Nome</th>
              <th>NCM</th>
              <th>CFOP</th>
              <th>CSOSN</th>
              <th>Em uso</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {profiles.length === 0 ? (
              <tr>
                <td className="py-3 text-slate-500" colSpan={6}>
                  Nenhum perfil fiscal cadastrado.
                </td>
              </tr>
            ) : (
              profiles.map((profile) => {
                const usage = profile.usage.categories + profile.usage.products + profile.usage.complements;
                return (
                  <tr className="border-t border-slate-100" key={profile.id}>
                    <td className="py-2 font-medium">
                      {profile.name}
                      {profile.active ? "" : " (inativo)"}
                    </td>
                    <td>{profile.ncm}</td>
                    <td>{profile.cfop}</td>
                    <td>{profile.csosn}</td>
                    <td>{usage}</td>
                    <td className="text-right">
                      <button
                        aria-label={`Editar ${profile.name}`}
                        className="rounded p-1 text-slate-600 hover:bg-slate-100"
                        onClick={() => setEditing({ id: profile.id, form: toPayload(profile) })}
                        type="button"
                      >
                        <Pencil aria-hidden className="h-4 w-4" />
                      </button>
                      <button
                        aria-label={`Excluir ${profile.name}`}
                        className="rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-40"
                        disabled={busy || usage > 0}
                        onClick={() => void run(() => actions.deleteProfile(profile.id), () => void reload())}
                        title={usage > 0 ? "Perfil em uso" : "Excluir"}
                        type="button"
                      >
                        <Trash2 aria-hidden className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      <section className={cardClass}>
        <h2 className="text-lg font-semibold">Atribuicao</h2>
        <p className="mt-1 text-sm text-slate-600">
          {missingCount === 0
            ? "Todos os produtos ativos tem perfil fiscal."
            : `${missingCount} produto(s)/complemento(s) sem perfil fiscal: atribua um perfil a categoria ou ao item.`}
        </p>
        {missing.products.length ? (
          <p className="mt-2 text-sm text-amber-800" data-testid="fiscal-missing">
            Sem perfil: {missing.products.map((product) => product.name).join(", ")}
          </p>
        ) : null}
        <div className="mt-4 space-y-3">
          {assignments.categories.map((category) => (
            <div className="rounded-md border border-slate-100 p-3" key={category.id}>
              <label className="text-sm font-semibold">
                {category.name}
                {profileSelect(categoryMap[category.id] ?? "", (value) => setCategoryMap({ ...categoryMap, [category.id]: value }), `Perfil da categoria ${category.name}`, "Sem perfil padrao")}
              </label>
              {showProducts ? (
                <div className="mt-2 grid gap-2 pl-4 sm:grid-cols-2">
                  {(productsByCategory.get(category.id) ?? []).map((product) => (
                    <label className="text-sm" key={product.id}>
                      {product.name}
                      {profileSelect(productMap[product.id] ?? "", (value) => setProductMap({ ...productMap, [product.id]: value }), `Perfil do produto ${product.name}`, "Usar o da categoria")}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          {showProducts && assignments.complements.length ? (
            <div className="rounded-md border border-slate-100 p-3">
              <p className="text-sm font-semibold">Complementos pagos</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {assignments.complements.map((complement) => (
                  <label className="text-sm" key={complement.id}>
                    {complement.name}
                    {profileSelect(complementMap[complement.id] ?? "", (value) => setComplementMap({ ...complementMap, [complement.id]: value }), `Perfil do complemento ${complement.name}`, "Usar o do produto")}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} onClick={() => void saveAssignments()} type="button">
            Salvar atribuicao
          </button>
          <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold" onClick={() => setShowProducts((value) => !value)} type="button">
            {showProducts ? "Ocultar produtos e complementos" : "Ajustar por produto ou complemento"}
          </button>
        </div>
      </section>
    </div>
  );
}

function toMap(items: Array<{ id: string; fiscalProfileId: string | null }>): Record<string, string> {
  return Object.fromEntries(items.map((item) => [item.id, item.fiscalProfileId ?? ""]));
}

function toPayload(profile: FiscalProfileView): FiscalProfilePayload {
  const { name, ncm, cfop, csosn, origin, commercialUnit, cest, benefitCode, active } = profile;
  return { name, ncm, cfop, csosn, origin, commercialUnit, cest, benefitCode, active };
}
