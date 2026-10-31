"use client";

import React, { useState } from "react";
import type { OperationState, StoreAddress, StoreDetail, StoreProfileInput, StoreSocialLinks } from "@rrfive/types";
import { Store } from "lucide-react";
import { OperationFeedback } from "../../../../components/admin/operation-feedback";
import {
  StoreLegalFields,
  toStoreLegalForm,
  toStoreLegalInput,
  type StoreLegalFormState,
} from "../../../../components/admin/store-legal-fields";
import { idleOperationState } from "../../../../lib/operation-state";

export type StoreProfileActionState = OperationState & { data?: StoreDetail };

interface Props {
  store: StoreDetail;
  saveAction: (payload: StoreProfileInput) => Promise<StoreProfileActionState>;
}

const ADDRESS_FIELDS: Array<[keyof StoreAddress, string]> = [
  ["street", "Logradouro"],
  ["number", "Numero"],
  ["complement", "Complemento"],
  ["neighborhood", "Bairro"],
  ["city", "Cidade"],
  ["state", "UF"],
  ["postalCode", "CEP"],
];
const SOCIAL_FIELDS: Array<[keyof StoreSocialLinks, string]> = [
  ["instagram", "Instagram"],
  ["facebook", "Facebook"],
  ["whatsapp", "WhatsApp"],
  ["website", "Site"],
];
const inputClass = "rounded-md border border-slate-300 px-3 py-2";
const cardClass = "grid gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm";

/** The store admin edits identity, contact and fiscal data of its own store. */
export function StoreProfileClient({ store: initialStore, saveAction }: Props) {
  const [store, setStore] = useState(initialStore);
  const [name, setName] = useState(store.name);
  const [phone, setPhone] = useState(store.phone);
  const [address, setAddress] = useState<StoreAddress>(store.address ?? {});
  const [socialLinks, setSocialLinks] = useState<StoreSocialLinks>(store.socialLinks ?? {});
  const [legal, setLegal] = useState<StoreLegalFormState>(() => toStoreLegalForm(store.legal));
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<OperationState>(idleOperationState);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback({ status: "pending", message: "Salvando os dados da loja." });
    try {
      const trim = <T extends object>(value: T) =>
        Object.fromEntries(Object.entries(value).map(([key, text]) => [key, typeof text === "string" ? text.trim() : text])) as T;
      const result = await saveAction({
        name: name.trim(),
        phone: phone.trim(),
        address: { ...trim(address), state: address.state?.trim().toUpperCase() },
        socialLinks: trim(socialLinks),
        ...toStoreLegalInput(legal),
      });
      setFeedback({ status: result.status, message: result.message });
      if (result.status === "success" && result.data) {
        setStore(result.data);
        setLegal(toStoreLegalForm(result.data.legal));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <section className="mx-auto max-w-4xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase text-tomato">Configuracoes</p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold">
            <Store aria-hidden className="h-7 w-7" /> Dados da loja
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Contato, endereco e dados fiscais da loja. Endereco do cardapio, dominio e ativacao da loja sao alterados pela plataforma.
          </p>
        </header>

        <OperationFeedback onDismiss={() => setFeedback(idleOperationState)} state={feedback} />

        <dl className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 text-sm sm:grid-cols-3" data-testid="store-platform-fields">
          <div>
            <dt className="text-xs uppercase text-slate-500">Endereco do cardapio</dt>
            <dd>/{store.slug}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Dominio</dt>
            <dd>{store.publicDomain ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Situacao</dt>
            <dd>{store.active ? "Ativa" : "Desativada"}</dd>
          </div>
        </dl>

        <form className="space-y-6" onSubmit={submit}>
          <section className={cardClass}>
            <h2 className="text-lg font-semibold">Identificacao e contato</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium">
                Nome da loja
                <input aria-label="Nome da loja" className={inputClass} minLength={2} onChange={(event) => setName(event.target.value)} required value={name} />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Telefone
                <input aria-label="Telefone" className={inputClass} onChange={(event) => setPhone(event.target.value)} value={phone} />
              </label>
            </div>
          </section>

          <section className={cardClass}>
            <h2 className="text-lg font-semibold">Endereco</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {ADDRESS_FIELDS.map(([key, label]) => (
                <label className="grid gap-1 text-sm font-medium" key={key}>
                  {label}
                  <input
                    aria-label={label}
                    className={`${inputClass} ${key === "state" ? "uppercase" : ""}`}
                    maxLength={key === "state" ? 2 : undefined}
                    onChange={(event) => setAddress({ ...address, [key]: event.target.value })}
                    value={address[key] ?? ""}
                  />
                </label>
              ))}
            </div>
          </section>

          <div className={cardClass}>
            <StoreLegalFields legal={store.legal} onChange={setLegal} value={legal} />
          </div>

          <section className={cardClass}>
            <h2 className="text-lg font-semibold">Redes sociais</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {SOCIAL_FIELDS.map(([key, label]) => (
                <label className="grid gap-1 text-sm font-medium" key={key}>
                  {label}
                  <input aria-label={label} className={inputClass} onChange={(event) => setSocialLinks({ ...socialLinks, [key]: event.target.value })} value={socialLinks[key] ?? ""} />
                </label>
              ))}
            </div>
          </section>

          <button className="rounded-md bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} type="submit">
            Salvar dados da loja
          </button>
        </form>
      </section>
    </main>
  );
}
