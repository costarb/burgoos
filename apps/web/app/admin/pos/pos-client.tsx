"use client";

import React, { useMemo, useState } from "react";
import type {
  FulfillmentMethod,
  PosCatalog,
  PosCatalogProduct,
  PosOrder,
  PendingPaymentOrder,
  ServiceTabSummary,
} from "@burgoos/types";
import {
  createCounterOrder,
  openServiceTab,
  updateCounterOrder,
} from "../../../lib/api";
import { CustomizedCartItem, ItemCustomizationDialog } from "./item-customization-dialog";
import { PaymentCheckoutDialog } from "./payment-checkout-dialog";

export function estimatedCartTotal(items: CustomizedCartItem[]): number {
  return items.reduce((total, item) => {
    const extras = item.modifications
      .filter((modification) => modification.type === "ADD_COMPLEMENT")
      .reduce((sum, modification) => {
        const complement = item.product.complements.find(
          (candidate) => candidate.id === modification.referenceId,
        );
        return sum + Number(complement?.price ?? 0) * modification.quantity;
      }, 0);
    return total + Number(item.chargedUnitPrice || Number(item.product.price) + extras) * item.quantity;
  }, 0);
}

export function cartFromOrder(catalog: PosCatalog, order: PosOrder): CustomizedCartItem[] {
  const products = new Map(
    catalog.categories
      .flatMap((category) => category.products)
      .map((product) => [product.id, product]),
  );

  return order.items.flatMap((item) => {
    const product = products.get(item.productId);
    if (!product) return [];
    return [{
      key: item.id,
      product,
      quantity: item.quantity,
      modifications: item.modifications.map((modification) => ({
        type: modification.type,
        referenceId: modification.referenceId,
        quantity: modification.quantity,
      })),
      chargedUnitPrice:
        item.manualAdjustmentAmount !== "0.00" ? item.chargedUnitPrice : undefined,
      priceOverrideReason: item.manualAdjustmentReason ?? undefined,
      notes: item.notes ?? undefined,
    }];
  });
}

export function PosClient({
  catalog,
  initialTabs = [],
  initialServiceTabId = "",
  initialOrder,
  initialPendingPayments = [],
}: {
  catalog: PosCatalog;
  initialTabs?: ServiceTabSummary[];
  initialServiceTabId?: string;
  initialOrder?: PosOrder;
  initialPendingPayments?: PendingPaymentOrder[];
}) {
  const editing = Boolean(initialOrder);
  const [categoryId, setCategoryId] = useState(catalog.categories[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CustomizedCartItem[]>(() =>
    initialOrder ? cartFromOrder(catalog, initialOrder) : [],
  );
  const [customizing, setCustomizing] = useState<{
    product: PosCatalogProduct;
    item?: CustomizedCartItem;
  } | null>(null);
  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod>(
    initialOrder?.fulfillmentMethod ?? "PICKUP",
  );
  const [customerName, setCustomerName] = useState(initialOrder?.customerName ?? "");
  const [customerPhone, setCustomerPhone] = useState(initialOrder?.customerPhone ?? "");
  const [orderNotes, setOrderNotes] = useState(initialOrder?.notes ?? "");
  const [orderVersion, setOrderVersion] = useState(initialOrder?.version ?? 0);
  const [createdOrder, setCreatedOrder] = useState<PosOrder | null>(null);
  const [pendingPayments, setPendingPayments] = useState(initialPendingPayments);
  const [pendingPaymentsOpen, setPendingPaymentsOpen] = useState(false);
  const [checkoutPending, setCheckoutPending] = useState<PendingPaymentOrder | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [tabs, setTabs] = useState(initialTabs);
  const [serviceTabId, setServiceTabId] = useState(
    initialOrder?.serviceTabId ?? initialServiceTabId,
  );
  const [newTabNumber, setNewTabNumber] = useState("");
  const products = useMemo(
    () =>
      catalog.categories
        .filter((category) => !categoryId || category.id === categoryId)
        .flatMap((category) => category.products)
        .filter((product) => product.name.toLowerCase().includes(search.toLowerCase())),
    [catalog, categoryId, search],
  );

  async function submitOrder() {
    setSubmitting(true);
    setFeedback(null);
    const items = cart.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
      modifications: item.modifications,
      chargedUnitPrice: item.chargedUnitPrice,
      priceOverrideReason: item.priceOverrideReason,
      notes: item.notes,
    }));

    try {
      if (initialOrder) {
        const order = await updateCounterOrder(initialOrder.id, {
          expectedVersion: orderVersion,
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
          fulfillmentMethod,
          notes: orderNotes || undefined,
          items,
        });
        setOrderVersion(order.version);
        setFeedback(`Pedido ${order.publicCode} atualizado e comunicado ao KDS.`);
      } else {
        const order = await createCounterOrder(
          {
            serviceTabId: serviceTabId || undefined,
            customerName: customerName || undefined,
            customerPhone: customerPhone || undefined,
            fulfillmentMethod,
            notes: orderNotes || undefined,
            releaseToKds: true,
            items,
          },
          crypto.randomUUID(),
        );
        setCart([]);
        setCustomerName("");
        setCustomerPhone("");
        setOrderNotes("");
        setCreatedOrder(order);
        setPendingPayments((current) => [{
          id: order.id,
          publicCode: order.publicCode,
          customerName: order.customerName,
          status: order.status,
          total: order.total,
          paidAmount: "0.00",
          openBalance: order.total,
          createdAt: order.createdAt,
          assignment: order.assignment,
          items: order.items.map((item) => ({
            id: item.id,
            productName: item.productNameSnapshot,
            quantity: item.quantity,
            notes: item.notes,
            modifications: item.modifications.map((modification) => ({
              id: modification.id,
              type: modification.type,
              name: modification.nameSnapshot,
              quantity: modification.quantity,
            })),
          })),
        }, ...current.filter((candidate) => candidate.id !== order.id)]);
        setFeedback(`Pedido ${order.publicCode} enviado para a cozinha.`);
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível salvar o pedido.");
    } finally {
      setSubmitting(false);
    }
  }

  async function createTab() {
    if (!newTabNumber.trim()) return;
    setSubmitting(true);
    try {
      const tab = await openServiceTab(
        { number: newTabNumber, displayName: customerName || undefined },
        crypto.randomUUID(),
      );
      setTabs((current) => [...current, tab]);
      setServiceTabId(tab.id);
      setNewTabNumber("");
      setFeedback(`Comanda ${tab.number} aberta e selecionada.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível abrir a comanda.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-[calc(100vh-5rem)] gap-4 p-4 lg:grid-cols-[1fr_360px]">
      <section>
        <header className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                {initialOrder
                  ? `Editar pedido ${initialOrder.publicCode ?? initialOrder.id.slice(0, 8)}`
                  : "Capturar pedido"}
              </h1>
              {initialOrder ? (
                <p className="mt-1 text-sm text-amber-700">
                  As alterações serão recalculadas e enviadas para a cozinha.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="relative min-h-11 rounded-lg border border-amber-300 bg-amber-50 px-4 pr-11 text-sm font-semibold text-amber-950"
                onClick={() => setPendingPaymentsOpen(true)}
                type="button"
              >
                Pagamentos pendentes
                <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
                  {pendingPayments.length}
                </span>
              </button>
              {initialOrder ? (
                <a className="rounded-lg border px-4 py-2 font-medium" href="/admin/orders">
                  Voltar ao KDS
                </a>
              ) : null}
            </div>
          </div>
          <input
            aria-label="Buscar produto"
            className="mt-3 min-h-12 w-full rounded-lg border px-4"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar produto"
            value={search}
          />
          <nav aria-label="Categorias" className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {catalog.categories.map((category) => (
              <button
                className={`min-h-12 whitespace-nowrap rounded-lg px-4 font-medium ${
                  category.id === categoryId ? "bg-slate-900 text-white" : "border bg-white"
                }`}
                key={category.id}
                onClick={() => setCategoryId(category.id)}
                type="button"
              >
                {category.name}
              </button>
            ))}
          </nav>
        </header>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <button
              className="min-h-32 rounded-xl border bg-white p-4 text-left shadow-sm disabled:opacity-50"
              disabled={!product.active}
              key={product.id}
              onClick={() => setCustomizing({ product })}
              type="button"
            >
              <strong className="block">{product.name}</strong>
              <span className="mt-2 block text-lg font-semibold">R$ {product.price}</span>
              {(product.ingredients.length > 0 || product.complements.length > 0) && (
                <span className="mt-2 block text-xs text-slate-500">Personalizável</span>
              )}
            </button>
          ))}
          {products.length === 0 && (
            <p className="col-span-full rounded-xl border border-dashed p-8 text-center text-slate-500">
              Nenhum produto disponível.
            </p>
          )}
        </div>
      </section>

      <aside className="h-fit rounded-xl bg-white p-4 shadow-sm lg:sticky lg:top-4">
        <h2 className="text-lg font-semibold">Resumo do pedido</h2>
        {serviceTabId && (
          <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950">
            <strong>
              Pedido vinculado à comanda{" "}
              {tabs.find((tab) => tab.id === serviceTabId)?.number ?? ""}
            </strong>
            <p className="mt-1">
              {editing
                ? "O vínculo da comanda é preservado durante a alteração."
                : "Ao confirmar, o valor será incluído no saldo da comanda."}
            </p>
          </div>
        )}
        <div className="mt-3 space-y-3">
          {cart.map((item) => (
            <div className="rounded-lg border p-3" key={item.key}>
              <strong>{item.quantity}× {item.product.name}</strong>
              {item.modifications.length > 0 ? (
                <ul className="mt-1 text-xs text-slate-600">
                  {item.modifications.map((modification) => (
                    <li key={`${modification.type}-${modification.referenceId}`}>
                      {modificationLabel(item, modification)}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-2 flex gap-3">
                <button
                  className="text-sm text-slate-700 underline"
                  onClick={() => setCustomizing({ product: item.product, item })}
                  type="button"
                >
                  Editar
                </button>
                <button
                  className="text-sm text-red-700"
                  onClick={() =>
                    setCart((current) => current.filter((entry) => entry.key !== item.key))
                  }
                  type="button"
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
          {cart.length === 0 && (
            <p className="text-sm text-slate-500">Selecione os produtos ao lado.</p>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {(["PICKUP", "DELIVERY"] as FulfillmentMethod[]).map((method) => (
            <button
              className={`min-h-12 rounded-lg border ${
                fulfillmentMethod === method ? "bg-slate-900 text-white" : ""
              }`}
              key={method}
              onClick={() => setFulfillmentMethod(method)}
              type="button"
            >
              {method === "PICKUP" ? "Retirada / local" : "Delivery"}
            </button>
          ))}
        </div>
        <input
          aria-label="Nome ou identificação do cliente"
          className="mt-3 min-h-12 w-full rounded-lg border px-3"
          onChange={(event) => setCustomerName(event.target.value)}
          placeholder="Nome ou identificação"
          value={customerName}
        />
        <input
          aria-label="Telefone do cliente"
          className="mt-3 min-h-12 w-full rounded-lg border px-3"
          onChange={(event) => setCustomerPhone(event.target.value)}
          placeholder="Telefone (opcional)"
          value={customerPhone}
        />
        <textarea
          aria-label="Observações gerais do pedido"
          className="mt-3 min-h-20 w-full rounded-lg border p-3"
          onChange={(event) => setOrderNotes(event.target.value)}
          placeholder="Observações gerais do pedido"
          value={orderNotes}
        />
        <label className="mt-3 block text-sm">
          Comanda opcional
          <select
            className="mt-1 min-h-12 w-full rounded-lg border px-3 disabled:bg-slate-100"
            disabled={editing}
            onChange={(event) => setServiceTabId(event.target.value)}
            value={serviceTabId}
          >
            <option value="">Pedido avulso</option>
            {tabs.filter((tab) => tab.status === "OPEN").map((tab) => (
              <option key={tab.id} value={tab.id}>
                Comanda {tab.number}{tab.displayName ? ` · ${tab.displayName}` : ""}
              </option>
            ))}
          </select>
        </label>
        {!editing ? (
          <div className="mt-2 flex gap-2">
            <input
              aria-label="Nova comanda"
              className="min-h-12 min-w-0 flex-1 rounded-lg border px-3"
              onChange={(event) => setNewTabNumber(event.target.value)}
              placeholder="Abrir nova comanda"
              value={newTabNumber}
            />
            <button
              className="min-h-12 rounded-lg border px-4 font-semibold"
              disabled={submitting || !newTabNumber.trim()}
              onClick={createTab}
              type="button"
            >
              Abrir
            </button>
          </div>
        ) : null}
        <div className="mt-5 flex justify-between text-xl font-semibold">
          <span>Total estimado</span>
          <span>R$ {estimatedCartTotal(cart).toFixed(2)}</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          O valor final será validado no servidor.
        </p>
        <button
          className="mt-4 min-h-14 w-full rounded-lg bg-emerald-700 px-4 font-semibold text-white disabled:opacity-50"
          disabled={cart.length === 0 || submitting}
          onClick={submitOrder}
          type="button"
        >
          {submitting
            ? "Salvando..."
            : editing
              ? "Salvar alterações no pedido"
              : "Criar pedido e enviar ao KDS"}
        </button>
        {feedback && (
          <p aria-live="polite" className="mt-3 rounded-lg bg-slate-100 p-3 text-sm">
            {feedback}
          </p>
        )}
      </aside>

      {customizing && (
        <ItemCustomizationDialog
          initialItem={customizing.item}
          onCancel={() => setCustomizing(null)}
          onConfirm={(item) => {
            setCart((current) =>
              customizing.item
                ? current.map((entry) => (entry.key === item.key ? item : entry))
                : [...current, item],
            );
            setCustomizing(null);
          }}
          product={customizing.product}
        />
      )}
      {pendingPaymentsOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-4">
          <section className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Pagamentos pendentes</h2>
                <p className="text-sm text-slate-500">
                  Pedidos avulsos com saldo em aberto.
                </p>
              </div>
              <button
                aria-label="Fechar pagamentos pendentes"
                className="rounded-lg border px-3 py-2"
                onClick={() => setPendingPaymentsOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {pendingPayments.map((order) => (
                <article className="rounded-lg border p-4" key={order.id}>
                  <div className="flex justify-between gap-3">
                    <PendingPaymentOrderIdentification order={order} />
                    <strong>R$ {order.openBalance}</strong>
                  </div>
                  <PendingPaymentItems items={order.items} />
                  <button
                    className="mt-3 min-h-11 w-full rounded-lg bg-blue-800 px-3 text-sm font-semibold text-white"
                    onClick={() => {
                      setPendingPaymentsOpen(false);
                      setCheckoutPending(order);
                    }}
                    type="button"
                  >
                    Retomar cobrança
                  </button>
                </article>
              ))}
              {pendingPayments.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Nenhum pedido avulso aguardando cobrança.
                </p>
              ) : null}
            </div>
            {tabs.some((tab) => Number(tab.openBalance) > 0) ? (
              <a
                className="mt-4 inline-block rounded-lg border px-4 py-3 text-sm font-semibold"
                href="/admin/tabs"
              >
                Ver comandas com saldo em aberto
              </a>
            ) : null}
          </section>
        </div>
      ) : null}
      {checkoutPending ? (
        <PaymentCheckoutDialog
          amount={checkoutPending.openBalance}
          assignment={checkoutPending.assignment}
          onApproved={() => {
            setPendingPayments((current) =>
              current.filter((candidate) => candidate.id !== checkoutPending.id),
            );
          }}
          onClose={() => setCheckoutPending(null)}
          targetId={checkoutPending.id}
          targetType="ORDER"
          title={`Cobrar pedido #${checkoutPending.publicCode}`}
        />
      ) : null}
      {createdOrder ? (
        <PaymentCheckoutDialog
          amount={createdOrder.total}
          assignment={createdOrder.assignment}
          onApproved={() => {
            setPendingPayments((current) =>
              current.filter((candidate) => candidate.id !== createdOrder.id),
            );
            setCreatedOrder(null);
          }}
          onClose={() => setCreatedOrder(null)}
          targetId={createdOrder.id}
          targetType="ORDER"
          title={`Cobrar pedido #${createdOrder.publicCode}`}
        />
      ) : null}
    </div>
  );
}

export function PendingPaymentOrderIdentification({
  order,
}: {
  order: PendingPaymentOrder;
}) {
  return (
    <div>
      <div className="inline-flex items-baseline gap-1 rounded-lg border border-amber-300 bg-amber-100 px-3 py-1.5 text-amber-950 shadow-sm">
        <span className="text-xs font-semibold uppercase tracking-wide">Pedido</span>
        <strong className="text-xl leading-none">#{order.publicCode}</strong>
      </div>
      <p className="mt-2 font-semibold text-slate-900">
        {order.customerName || "Balcão"}
      </p>
      <p className="text-xs text-slate-500">
        {new Date(order.createdAt).toLocaleString("pt-BR")} · {order.status}
      </p>
    </div>
  );
}

export function PendingPaymentItems({
  items,
}: {
  items: PendingPaymentOrder["items"];
}) {
  return (
    <ul className="mt-3 space-y-2 border-t pt-3">
      {items.map((item) => (
        <li className="text-sm" key={item.id}>
          <div className="font-medium">
            {item.quantity}× {item.productName}
          </div>
          {item.modifications.map((modification) => (
            <div className="text-xs text-slate-600" key={modification.id}>
              {modification.type === "REMOVE_INGREDIENT"
                ? `Sem ${modification.name}`
                : `+ ${formatModificationQuantity(modification.quantity)} ${modification.name}`}
            </div>
          ))}
          {item.notes ? (
            <div className="text-xs text-amber-700">Obs.: {item.notes}</div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function formatModificationQuantity(quantity: number) {
  return Number.isInteger(quantity) ? quantity.toString() : quantity.toLocaleString("pt-BR");
}

function modificationLabel(
  item: CustomizedCartItem,
  modification: CustomizedCartItem["modifications"][number],
): string {
  if (modification.type === "REMOVE_INGREDIENT") {
    const name = item.product.ingredients.find(
      (ingredient) => ingredient.id === modification.referenceId,
    )?.name;
    return `Sem ${name ?? "ingrediente"}`;
  }
  const name = item.product.complements.find(
    (complement) => complement.id === modification.referenceId,
  )?.name;
  return `Adicionar ${modification.quantity}x ${name ?? "complemento"}`;
}
