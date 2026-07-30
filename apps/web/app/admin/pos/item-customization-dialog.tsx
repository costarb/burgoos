"use client";

import React from "react";
import { useMemo, useState } from "react";
import type { CounterOrderItemModificationInput, PosCatalogProduct } from "@burgoos/types";

export interface CustomizedCartItem {
  key: string;
  product: PosCatalogProduct;
  quantity: number;
  modifications: CounterOrderItemModificationInput[];
  chargedUnitPrice?: string;
  priceOverrideReason?: string;
  notes?: string;
}

export function normalizeOptionalChargedPrice(
  value: string,
  calculatedPrice: number,
): string | undefined | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return undefined;
  if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(normalized)) return null;
  const formatted = Number(normalized).toFixed(2);
  return formatted === calculatedPrice.toFixed(2) ? undefined : formatted;
}

export function ItemCustomizationDialog({
  product,
  initialItem,
  onCancel,
  onConfirm,
}: {
  product: PosCatalogProduct;
  initialItem?: CustomizedCartItem;
  onCancel: () => void;
  onConfirm: (item: CustomizedCartItem) => void;
}) {
  const [removed, setRemoved] = useState<string[]>(
    initialItem?.modifications
      .filter((item) => item.type === "REMOVE_INGREDIENT")
      .map((item) => item.referenceId) ?? [],
  );
  const [extras, setExtras] = useState<Record<string, number>>(
    Object.fromEntries(
      initialItem?.modifications
        .filter((item) => item.type === "ADD_COMPLEMENT")
        .map((item) => [item.referenceId, item.quantity]) ?? [],
    ),
  );
  const [quantity, setQuantity] = useState(initialItem?.quantity ?? 1);
  const [chargedUnitPrice, setChargedUnitPrice] = useState(
    initialItem?.chargedUnitPrice ?? "",
  );
  const [reason, setReason] = useState(initialItem?.priceOverrideReason ?? "");
  const [notes, setNotes] = useState(initialItem?.notes ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);
  const estimated = useMemo(
    () =>
      product.complements.reduce(
        (sum, item) => sum + Number(item.price) * (extras[item.id] ?? 0),
        Number(product.price),
      ),
    [extras, product],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <section
        aria-label={`Personalizar ${product.name}`}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
      >
        <h2 className="text-xl font-semibold">{product.name}</h2>
        <p className="mt-1 text-sm text-slate-500">Preço estimado: R$ {estimated.toFixed(2)}</p>

        <label className="mt-4 block text-sm font-medium">
          Quantidade
          <input
            className="mt-1 w-24 rounded-lg border p-3"
            min={1}
            onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))}
            type="number"
            value={quantity}
          />
        </label>

        <fieldset className="mt-5">
          <legend className="font-semibold">Retirar ingredientes</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {product.ingredients.map((ingredient) => (
              <label key={ingredient.id} className="flex min-h-12 items-center gap-3 rounded-lg border p-3">
                <input
                  checked={removed.includes(ingredient.id)}
                  onChange={(event) =>
                    setRemoved((current) =>
                      event.target.checked
                        ? [...current, ingredient.id]
                        : current.filter((id) => id !== ingredient.id),
                    )
                  }
                  type="checkbox"
                />
                Sem {ingredient.name}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-5">
          <legend className="font-semibold">Adicionar complementos</legend>
          <div className="mt-2 space-y-2">
            {product.complements.map((complement) => (
              <div key={complement.id} className="flex min-h-14 items-center justify-between rounded-lg border p-3">
                <span>{complement.name} · + R$ {complement.price}</span>
                <input
                  aria-label={`Quantidade de ${complement.name}`}
                  className="w-20 rounded border p-2"
                  max={complement.maxQuantity}
                  min={0}
                  onChange={(event) =>
                    setExtras((current) => ({
                      ...current,
                      [complement.id]: Number(event.target.value),
                    }))
                  }
                  type="number"
                  value={extras[complement.id] ?? 0}
                />
              </div>
            ))}
          </div>
        </fieldset>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Alterar valor unitário
            <input
              className="mt-1 w-full rounded-lg border p-3"
              inputMode="decimal"
              onChange={(event) => setChargedUnitPrice(event.target.value)}
              placeholder={estimated.toFixed(2)}
              value={chargedUnitPrice}
            />
          </label>
          <label className="text-sm">
            Motivo da alteração
            <input className="mt-1 w-full rounded-lg border p-3" onChange={(event) => setReason(event.target.value)} value={reason} />
          </label>
        </div>
        <label className="mt-3 block text-sm">
          Observações para a cozinha
          <textarea className="mt-1 w-full rounded-lg border p-3" onChange={(event) => setNotes(event.target.value)} value={notes} />
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button className="min-h-12 rounded-lg border px-5" onClick={onCancel} type="button">Cancelar</button>
          <button
            className="min-h-12 rounded-lg bg-slate-900 px-5 font-semibold text-white"
            onClick={() => {
              const normalizedChargedPrice = normalizeOptionalChargedPrice(
                chargedUnitPrice,
                estimated,
              );
              if (normalizedChargedPrice === null) {
                setValidationError("Informe o valor no formato 22,00 ou 22.00.");
                return;
              }
              if (normalizedChargedPrice && !reason.trim()) {
                setValidationError("Informe o motivo da alteração do preço.");
                return;
              }
              setValidationError(null);
              onConfirm({
                key: initialItem?.key ?? crypto.randomUUID(),
                product,
                quantity,
                modifications: [
                  ...removed.map((referenceId) => ({
                    type: "REMOVE_INGREDIENT" as const,
                    referenceId,
                    quantity: 1,
                  })),
                  ...Object.entries(extras)
                    .filter(([, quantity]) => quantity > 0)
                    .map(([referenceId, quantity]) => ({
                      type: "ADD_COMPLEMENT" as const,
                      referenceId,
                      quantity,
                    })),
                ],
                chargedUnitPrice: normalizedChargedPrice,
                priceOverrideReason: normalizedChargedPrice ? reason.trim() : undefined,
                notes: notes || undefined,
              });
            }}
            type="button"
          >
            {initialItem ? "Salvar item" : "Adicionar ao pedido"}
          </button>
        </div>
        {validationError && (
          <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
            {validationError}
          </p>
        )}
      </section>
    </div>
  );
}
