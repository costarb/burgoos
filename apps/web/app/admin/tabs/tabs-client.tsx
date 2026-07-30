"use client";

import React, { FormEvent, useState } from "react";
import type { ServiceTabDetail, ServiceTabSummary } from "@burgoos/types";
import {
  checkoutServiceTab,
  getServiceTab,
  openServiceTab,
  reopenServiceTab,
} from "../../../lib/api";
import { AssignmentControl } from "../orders/assignment-control";
import { readAuthSession } from "../../../lib/auth-client";
import { PaymentCheckoutDialog } from "../pos/payment-checkout-dialog";

export function TabsClient({
  initialTabs,
  initialSelected = null,
}: {
  initialTabs: ServiceTabSummary[];
  initialSelected?: ServiceTabDetail | null;
}) {
  const [tabs, setTabs] = useState(initialTabs);
  const [selected, setSelected] = useState<ServiceTabDetail | null>(initialSelected);
  const [number, setNumber] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  function replaceTab(tab: ServiceTabSummary) {
    setTabs((current) => {
      const remaining = current.filter((candidate) => candidate.id !== tab.id);
      return tab.status === "OPEN" || tab.status === "CHECKOUT_PENDING"
        ? [...remaining, tab].sort((a, b) => a.openedAt.localeCompare(b.openedAt))
        : remaining;
    });
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const tab = await openServiceTab(
        { number, displayName: displayName || undefined },
        crypto.randomUUID(),
      );
      replaceTab(tab);
      setSelected(tab);
      setNumber("");
      setDisplayName("");
      setFeedback(`Comanda ${tab.number} aberta.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível abrir a comanda.");
    } finally {
      setBusy(false);
    }
  }

  async function select(tabId: string) {
    setBusy(true);
    try {
      setSelected(await getServiceTab(tabId));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível carregar a comanda.");
    } finally {
      setBusy(false);
    }
  }

  async function transition(action: "checkout" | "reopen") {
    if (!selected) return;
    setBusy(true);
    try {
      const tab =
        action === "checkout"
          ? await checkoutServiceTab(selected.id, { expectedVersion: selected.version })
          : await reopenServiceTab(selected.id, {
              expectedVersion: selected.version,
              reason: "Reabertura solicitada pelo operador",
            });
      setSelected(tab);
      replaceTab(tab);
      setFeedback(action === "checkout" ? "Comanda aguardando pagamento." : "Comanda reaberta.");
      if (action === "checkout") setCheckoutOpen(true);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível atualizar a comanda.");
    } finally {
      setBusy(false);
    }
  }

  async function openCheckout() {
    if (!selected) return;
    setBusy(true);
    setFeedback(null);
    try {
      const current = await getServiceTab(selected.id);
      setSelected(current);
      replaceTab(current);
      if (Number(current.openBalance) <= 0) {
        setFeedback("A comanda nao possui saldo pendente.");
        return;
      }
      setCheckoutOpen(true);
    } catch (error) {
      setFeedback(error instanceof Error
        ? error.message
        : "Nao foi possivel atualizar o saldo da comanda.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[1fr_420px]">
      <section>
        <header className="rounded-xl bg-white p-4 shadow-sm">
          <h1 className="text-2xl font-semibold">Comandas</h1>
          <form className="mt-4 grid gap-2 sm:grid-cols-[140px_1fr_auto]" onSubmit={create}>
            <input
              aria-label="Número da comanda"
              className="min-h-12 rounded-lg border px-3"
              onChange={(event) => setNumber(event.target.value)}
              placeholder="Número"
              required
              value={number}
            />
            <input
              aria-label="Nome ou identificação"
              className="min-h-12 rounded-lg border px-3"
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Nome ou identificação"
              value={displayName}
            />
            <button className="min-h-12 rounded-lg bg-slate-900 px-5 font-semibold text-white" disabled={busy} type="submit">
              Abrir comanda
            </button>
          </form>
        </header>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tabs.map((tab) => (
            <button
              className={`rounded-xl border bg-white p-4 text-left shadow-sm ${
                selected?.id === tab.id ? "border-slate-900 ring-2 ring-slate-200" : ""
              }`}
              key={tab.id}
              onClick={() => select(tab.id)}
              type="button"
            >
              <span className="text-xs font-semibold uppercase text-slate-500">
                {tab.status === "OPEN" ? "Aberta" : "Aguardando pagamento"}
              </span>
              <strong className="mt-1 block text-xl">Comanda {tab.number}</strong>
              {tab.displayName && <span className="block text-sm">{tab.displayName}</span>}
              <span className={`mt-2 block text-xs font-semibold ${tab.assignment ? "text-blue-700" : "text-amber-700"}`}>
                {tab.assignment ? `Responsavel: ${tab.assignment.userName}` : "Sem responsavel"}
              </span>
              <div className="mt-4 flex justify-between">
                <span>Saldo</span><strong>R$ {tab.openBalance}</strong>
              </div>
            </button>
          ))}
          {tabs.length === 0 && (
            <p className="col-span-full rounded-xl border border-dashed p-8 text-center text-slate-500">
              Nenhuma comanda aberta.
            </p>
          )}
        </div>
      </section>

      <aside className="h-fit rounded-xl bg-white p-4 shadow-sm lg:sticky lg:top-4">
        {!selected ? (
          <p className="text-slate-500">Selecione uma comanda para ver pedidos e saldo.</p>
        ) : (
          <>
            <h2 className="text-xl font-semibold">Comanda {selected.number}</h2>
            <p className="text-sm text-slate-500">{selected.displayName || selected.publicCode}</p>
            <AssignmentControl
              assignment={selected.assignment}
              onChanged={(result) => {
                const updated = {
                  ...selected,
                  assignedUserId: result.assignment.userId,
                  assignment: result.assignment,
                  version: result.version,
                };
                setSelected(updated);
                replaceTab(updated);
              }}
              target="tabs"
              targetId={selected.id}
              version={selected.version}
            />
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs">Consumo</dt><dd className="font-semibold">R$ {selected.grossTotal}</dd></div>
              <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs">Pago</dt><dd className="font-semibold">R$ {selected.paidAmount}</dd></div>
              <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs">Saldo</dt><dd className="font-semibold">R$ {selected.openBalance}</dd></div>
            </dl>
            <h3 className="mt-5 font-semibold">Pedidos</h3>
            <div className="mt-2 space-y-2">
              {selected.orders.map((order) => (
                <article className="rounded-lg border p-3" key={order.id}>
                  <div className="flex justify-between gap-3">
                    <span className="font-semibold">#{order.publicCode} · {order.status}</span>
                    <strong>R$ {order.total}</strong>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {order.source} · {new Date(order.createdAt).toLocaleString("pt-BR")}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {order.items.map((item) => (
                      <li key={item.id}>
                        {item.quantity}× {item.productNameSnapshot} — R$ {item.total}
                        {item.modifications.length > 0 && (
                          <ul className="ml-4 text-xs text-slate-500">
                            {item.modifications.map((modification) => (
                              <li key={modification.id}>
                                {modification.type === "REMOVE_INGREDIENT" ? "Sem" : "Adicionar"}{" "}
                                {modification.nameSnapshot}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
              {selected.orders.length === 0 && <p className="text-sm text-slate-500">Sem pedidos.</p>}
            </div>
            {selected.status === "OPEN" && (
              <a
                className="mt-3 block min-h-12 rounded-lg border px-4 py-3 text-center font-semibold"
                href={`/admin/pos?tabId=${encodeURIComponent(selected.id)}`}
              >
                Adicionar pedido
              </a>
            )}
            {selected.status === "OPEN" ? (
              <>
                {selected.assignment &&
                selected.assignment.userId !== readAuthSession()?.user.id ? (
                  <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
                    Esta comanda esta sob responsabilidade de {selected.assignment.userName}.
                    Transfira a responsabilidade antes de iniciar a cobranca.
                  </p>
                ) : null}
                <button
                  className="mt-5 min-h-12 w-full rounded-lg bg-emerald-700 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    busy ||
                    Boolean(
                      selected.assignment &&
                        selected.assignment.userId !== readAuthSession()?.user.id,
                    )
                  }
                  onClick={() => transition("checkout")}
                  type="button"
                >
                  Bloquear comanda para pagamento
                </button>
              </>
            ) : (
              <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4">
                <strong className="text-amber-950">Aguardando pagamento</strong>
                <p className="mt-1 text-sm text-amber-900">
                  A comanda está bloqueada para novos pedidos. Saldo a cobrar: R$ {selected.openBalance}.
                </p>
                <p className="mt-2 text-xs text-amber-800">
                  A cobrança pode ser retomada mesmo depois de sair desta tela.
                </p>
                <button
                  className="mt-3 min-h-12 w-full rounded-lg bg-blue-800 font-semibold text-white"
                  disabled={busy}
                  onClick={() => void openCheckout()}
                  type="button"
                >
                  Cobrar saldo da comanda
                </button>
                <button
                  className="mt-3 min-h-12 w-full rounded-lg border border-amber-400 bg-white font-semibold"
                  disabled={busy}
                  onClick={() => transition("reopen")}
                  type="button"
                >
                  Reabrir para adicionar pedidos
                </button>
              </div>
            )}
          </>
        )}
        {feedback && <p aria-live="polite" className="mt-3 rounded-lg bg-slate-100 p-3 text-sm">{feedback}</p>}
      </aside>
      {selected && checkoutOpen ? (
        <PaymentCheckoutDialog
          amount={selected.openBalance}
          assignment={selected.assignment}
          onClose={() => setCheckoutOpen(false)}
          targetId={selected.id}
          targetType="SERVICE_TAB"
          title={`Cobrar comanda ${selected.number}`}
        />
      ) : null}
    </div>
  );
}
