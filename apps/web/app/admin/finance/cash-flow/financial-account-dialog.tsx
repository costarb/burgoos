"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import type {
  FinancialAccount,
  FinancialAccountInput,
  FinancialCategory,
  FinancialCategoryInput,
  OperationState,
  PaymentInstitutionConfiguration,
} from "@burgoos/types";
import { ConfirmationDialog } from "../../../../components/admin/confirmation-dialog";
import { OperationFeedback } from "../../../../components/admin/operation-feedback";
import {
  createFinancialAccount,
  createFinancialCategory,
  listFinancialAccounts,
  listFinancialCategories,
  listPaymentInstitutions,
  updateFinancialAccount,
  updateFinancialCategory,
} from "../../../../lib/api";

interface FinancialAccountDialogProps {
  token: string;
  initialAccounts: FinancialAccount[];
  initialCategories: FinancialCategory[];
  initialInstitutions: PaymentInstitutionConfiguration[];
}

export function FinancialAccountDialog({
  token,
  initialAccounts,
  initialCategories,
  initialInstitutions,
}: FinancialAccountDialogProps) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [categories, setCategories] = useState(initialCategories);
  const [institutions, setInstitutions] = useState(initialInstitutions);
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);
  const [editingCategory, setEditingCategory] = useState<FinancialCategory | null>(null);
  const [operation, setOperation] = useState<OperationState>({ status: "idle" });
  const [busy, setBusy] = useState(false);

  async function run(message: string, action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setOperation({ status: "pending", message });

    try {
      await action();
      setOperation({ status: "success", message: "Configuracao financeira salva com sucesso." });
    } catch (error) {
      setOperation({
        status: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel salvar a configuracao.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    const [nextAccounts, nextCategories, nextInstitutions] = await Promise.all([
      listFinancialAccounts(token),
      listFinancialCategories(token),
      listPaymentInstitutions(token, { active: "true" }),
    ]);
    setAccounts(nextAccounts);
    setCategories(nextCategories);
    setInstitutions(nextInstitutions);
  }

  async function submitAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = accountPayload(formData);

    await run(
      editingAccount ? "Salvando conta financeira." : "Criando conta financeira.",
      async () => {
        if (editingAccount) {
          await updateFinancialAccount(token, editingAccount.id, payload);
          setEditingAccount(null);
        } else {
          await createFinancialAccount(token, payload);
        }

        await refresh();
        event.currentTarget.reset();
      }
    );
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = categoryPayload(formData);

    await run(
      editingCategory ? "Salvando categoria financeira." : "Criando categoria financeira.",
      async () => {
        if (editingCategory) {
          await updateFinancialCategory(token, editingCategory.id, payload);
          setEditingCategory(null);
        } else {
          await createFinancialCategory(token, payload);
        }

        await refresh();
        event.currentTarget.reset();
      }
    );
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Contas financeiras</h2>
            <p className="text-sm text-slate-500">
              Locais onde o dinheiro entra, sai ou fica alocado.
            </p>
          </div>
          {editingAccount ? (
            <button
              className="text-sm font-semibold text-slate-600"
              onClick={() => setEditingAccount(null)}
              type="button"
            >
              Cancelar edicao
            </button>
          ) : null}
        </div>

        <form className="mt-4 grid gap-3 md:grid-cols-5" onSubmit={submitAccount}>
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm md:col-span-2"
            defaultValue={editingAccount?.name ?? ""}
            key={editingAccount?.id ?? "new-account-name"}
            maxLength={80}
            name="name"
            placeholder="Nome da conta"
            required
          />
          <select
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            defaultValue={editingAccount?.paymentInstitutionId ?? ""}
            key={editingAccount?.id ?? "new-account-institution"}
            name="paymentInstitutionId"
          >
            <option value="">Sem instituicao</option>
            {institutions.map((institution) => (
              <option key={institution.id} value={institution.id}>
                {institution.name}
              </option>
            ))}
          </select>
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            defaultValue={editingAccount?.openingBalance ?? "0.00"}
            key={editingAccount?.id ?? "new-account-balance"}
            min="0"
            name="openingBalance"
            placeholder="Saldo inicial"
            required
            step="0.01"
            type="number"
          />
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            defaultValue={editingAccount?.openingBalanceAt ?? today()}
            key={editingAccount?.id ?? "new-account-date"}
            name="openingBalanceAt"
            required
            type="date"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              defaultChecked={editingAccount?.active ?? true}
              key={editingAccount?.id ?? "new-account-active"}
              name="active"
              type="checkbox"
            />
            Ativa
          </label>
          <button
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 md:col-span-4"
            disabled={busy}
            type="submit"
          >
            {busy ? "Processando..." : editingAccount ? "Salvar conta" : "Criar conta"}
          </button>
        </form>

        <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
          {accounts.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Nenhuma conta financeira cadastrada.</p>
          ) : (
            accounts.map((account) => (
              <div
                className="grid gap-2 border-b border-slate-100 p-3 last:border-b-0 md:grid-cols-[1fr_1fr_1fr_auto]"
                key={account.id}
              >
                <div>
                  <p className="font-semibold">{account.name}</p>
                  <p className="text-xs text-slate-500">{account.active ? "Ativa" : "Inativa"}</p>
                </div>
                <p className="text-sm text-slate-600">
                  {account.paymentInstitutionName ?? "Sem instituicao"}
                </p>
                <p className="text-sm font-semibold">R$ {account.openingBalance}</p>
                <button
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold"
                  onClick={() => setEditingAccount(account)}
                  type="button"
                >
                  Editar
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Categorias financeiras</h2>
            <p className="text-sm text-slate-500">
              Classificacao para contas a pagar e movimentos.
            </p>
          </div>
          {editingCategory ? (
            <button
              className="text-sm font-semibold text-slate-600"
              onClick={() => setEditingCategory(null)}
              type="button"
            >
              Cancelar edicao
            </button>
          ) : null}
        </div>

        <form className="mt-4 grid gap-3" onSubmit={submitCategory}>
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            defaultValue={editingCategory?.name ?? ""}
            key={editingCategory?.id ?? "new-category-name"}
            maxLength={80}
            name="name"
            placeholder="Nome da categoria"
            required
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              defaultChecked={editingCategory?.active ?? true}
              key={editingCategory?.id ?? "new-category-active"}
              name="active"
              type="checkbox"
            />
            Ativa
          </label>
          <button
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={busy}
            type="submit"
          >
            {busy ? "Processando..." : editingCategory ? "Salvar categoria" : "Criar categoria"}
          </button>
        </form>

        <div className="mt-4 space-y-2">
          {categories.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              Nenhuma categoria financeira cadastrada.
            </p>
          ) : (
            categories.map((category) => (
              <div
                className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3"
                key={category.id}
              >
                <div>
                  <p className="font-semibold">{category.name}</p>
                  <p className="text-xs text-slate-500">{category.active ? "Ativa" : "Inativa"}</p>
                </div>
                <button
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold"
                  onClick={() => setEditingCategory(category)}
                  type="button"
                >
                  Editar
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmationDialog
        confirmLabel="Entendi"
        description="Os saldos iniciais entram no calculo do caixa a partir da data informada. Alteracoes preservam os movimentos ja registrados."
        onCancel={() => setOperation({ status: "idle" })}
        onConfirm={() => setOperation({ status: "idle" })}
        open={operation.status === "success"}
        title="Configuracao salva"
      />
      <OperationFeedback
        className="lg:col-span-2"
        onDismiss={() => setOperation({ status: "idle" })}
        state={operation.status === "success" ? { status: "idle" } : operation}
      />
    </section>
  );
}

function accountPayload(formData: FormData): FinancialAccountInput {
  const paymentInstitutionId = String(formData.get("paymentInstitutionId") ?? "");

  return {
    name: String(formData.get("name") ?? ""),
    paymentInstitution: null,
    paymentInstitutionId: paymentInstitutionId || null,
    openingBalance: Number(formData.get("openingBalance") ?? 0),
    openingBalanceAt: String(formData.get("openingBalanceAt") ?? today()),
    active: formData.get("active") === "on",
  };
}

function categoryPayload(formData: FormData): FinancialCategoryInput {
  return {
    name: String(formData.get("name") ?? ""),
    active: formData.get("active") === "on",
  };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
