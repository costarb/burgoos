"use client";

import React from "react";
import type { StoreLegal, StoreLegalInput } from "@rrfive/types";

export interface StoreLegalFormState {
  legalName: string;
  tradeName: string;
  cnpj: string;
  stateRegistration: string;
  municipalityIbgeCode: string;
}

export const emptyStoreLegalForm: StoreLegalFormState = {
  legalName: "",
  tradeName: "",
  cnpj: "",
  stateRegistration: "",
  municipalityIbgeCode: "",
};

export function toStoreLegalForm(legal: StoreLegal | null | undefined): StoreLegalFormState {
  return {
    legalName: legal?.legalName ?? "",
    tradeName: legal?.tradeName ?? "",
    cnpj: legal?.cnpj ?? "",
    stateRegistration: legal?.stateRegistration ?? "",
    // Automatic codes are re-resolved from the city; only manual codes stay in the form.
    municipalityIbgeCode: legal?.municipalityIbgeSource === "MANUAL" ? (legal.municipalityIbgeCode ?? "") : "",
  };
}

/** Empty fields clear the value; the IBGE code empty means "resolve from the city". */
export function toStoreLegalInput(form: StoreLegalFormState): StoreLegalInput {
  const value = (text: string) => text.trim() || null;
  return {
    legalName: value(form.legalName),
    tradeName: value(form.tradeName),
    cnpj: value(form.cnpj),
    stateRegistration: value(form.stateRegistration),
    taxRegime: form.cnpj.trim() ? "SIMPLES_NACIONAL" : null,
    municipalityIbgeCode: value(form.municipalityIbgeCode),
  };
}

interface Props {
  value: StoreLegalFormState;
  onChange: (value: StoreLegalFormState) => void;
  legal?: StoreLegal | null;
  inputClassName?: string;
}

/** Fiscal identity of the store: shared by the platform store form and "Dados da loja". */
export function StoreLegalFields({ value, onChange, legal, inputClassName = "rounded-md border border-slate-300 px-3 py-2" }: Props) {
  const field = (key: keyof StoreLegalFormState, label: string, extra: { placeholder?: string; maxLength?: number } = {}) => (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      <input
        aria-label={label}
        className={inputClassName}
        maxLength={extra.maxLength}
        onChange={(event) => onChange({ ...value, [key]: event.target.value })}
        placeholder={extra.placeholder}
        value={value[key]}
      />
    </label>
  );

  return (
    <section className="grid gap-4" data-testid="store-legal-fields">
      <div>
        <h3 className="font-semibold">Dados fiscais</h3>
        <p className="text-sm text-slate-600">Usados na emissao de NFC-e. A inscricao estadual e validada com a UF do endereco.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {field("legalName", "Razao social", { maxLength: 120 })}
        {field("tradeName", "Nome fantasia", { maxLength: 120, placeholder: "Padrao: nome da loja" })}
        {field("cnpj", "CNPJ", { maxLength: 20 })}
        {field("stateRegistration", "Inscricao estadual", { maxLength: 20 })}
        <label className="grid gap-1 text-sm font-medium">
          Regime tributario
          <select className={inputClassName} disabled value="SIMPLES_NACIONAL">
            <option value="SIMPLES_NACIONAL">Simples Nacional / MEI</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Codigo IBGE do municipio
          <input
            aria-label="Codigo IBGE do municipio"
            className={inputClassName}
            maxLength={9}
            onChange={(event) => onChange({ ...value, municipalityIbgeCode: event.target.value })}
            placeholder={
              legal?.municipalityIbgeSource === "IBGE_API" && legal.municipalityIbgeCode
                ? `${legal.municipalityIbgeCode} (automatico pela cidade)`
                : "Automatico pela cidade"
            }
            value={value.municipalityIbgeCode}
          />
        </label>
      </div>
    </section>
  );
}
