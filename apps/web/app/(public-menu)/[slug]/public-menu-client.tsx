"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CreatedOrder,
  FulfillmentMethod,
  PaymentMethod,
  PublicMenu,
  PublicMenuProduct,
} from "@burgoos/types";
import { createPublicOrder } from "../../../lib/api";

interface CartLine {
  product: PublicMenuProduct;
  quantity: number;
}

interface PublicMenuClientProps {
  menu: PublicMenu;
}

const cartStorageKey = "burgoos:cart";

export function PublicMenuClient({ menu }: PublicMenuClientProps) {
  const branding = menu.tenant.branding;
  const primaryColor = branding?.primaryColor ?? "#C92A2A";
  const accentColor = branding?.accentColor ?? "#F59F00";
  const layoutPreset = branding?.layoutPreset ?? "classic";
  const showProductImages = branding?.showProductImages ?? false;
  const showProductDescriptions = branding?.showProductDescriptions ?? false;
  const orderingEnabled = branding?.orderingEnabled ?? true;
  const canOrder = menu.tenant.isOpen && orderingEnabled;
  const router = useRouter();
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod>("DELIVERY");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("PIX_MANUAL");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const storedCart = window.localStorage.getItem(`${cartStorageKey}:${menu.tenant.slug}`);

    if (storedCart) {
      setCart(JSON.parse(storedCart) as Record<string, CartLine>);
    }
  }, [menu.tenant.slug]);

  useEffect(() => {
    window.localStorage.setItem(`${cartStorageKey}:${menu.tenant.slug}`, JSON.stringify(cart));
  }, [cart, menu.tenant.slug]);

  const cartLines = useMemo(() => Object.values(cart), [cart]);
  const cartTotal = cartLines.reduce(
    (sum, line) => sum + Number(line.product.price) * line.quantity,
    0
  );

  function addProduct(product: PublicMenuProduct): void {
    setCreatedOrder(null);
    setError(null);
    setCart((current) => ({
      ...current,
      [product.id]: {
        product,
        quantity: (current[product.id]?.quantity ?? 0) + 1,
      },
    }));
  }

  function updateQuantity(productId: string, quantity: number): void {
    setCart((current) => {
      const currentLine = current[productId];

      if (!currentLine) {
        return current;
      }

      if (quantity <= 0) {
        const { [productId]: _removed, ...nextCart } = current;
        return nextCart;
      }

      return {
        ...current,
        [productId]: {
          ...currentLine,
          quantity,
        },
      };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setCreatedOrder(null);

    if (!orderingEnabled) {
      setError("Este cardapio esta disponivel apenas para consulta.");
      return;
    }

    if (!menu.tenant.isOpen) {
      setError("A loja esta fechada no momento.");
      return;
    }

    if (cartLines.length === 0) {
      setError("Adicione pelo menos um item ao carrinho.");
      return;
    }

    if (fulfillmentMethod === "DELIVERY" && deliveryAddress.trim().length === 0) {
      setError("Informe o endereco de entrega.");
      return;
    }

    setSubmitting(true);

    try {
      const order = await createPublicOrder(menu.tenant.slug, {
        customerName,
        customerPhone,
        fulfillmentMethod,
        paymentMethod,
        deliveryAddress:
          fulfillmentMethod === "DELIVERY"
            ? {
                address: deliveryAddress,
              }
            : undefined,
        notes: notes.trim() || undefined,
        items: cartLines.map((line) => ({
          productId: line.product.id,
          quantity: line.quantity,
        })),
      });

      setCreatedOrder(order);
      setCart({});
      router.push(
        `/${menu.tenant.slug}/pedido/${order.id}?total=${order.total}&whatsappUrl=${encodeURIComponent(
          order.whatsappUrl
        )}`
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Pedido recusado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      className={`public-menu-layout public-menu-layout-${layoutPreset} min-h-screen bg-cream text-ink`}
    >
      <header className="border-b border-orange-100 bg-white px-4 py-5 shadow-sm">
        {branding?.headerImageUrl ? (
          <img
            alt=""
            className="mx-auto mb-4 max-h-64 w-full max-w-5xl rounded-md object-cover"
            src={branding.headerImageUrl}
          />
        ) : null}
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase" style={{ color: primaryColor }}>
              {menu.tenant.slug}
            </p>
            <div className="mt-1 flex items-center gap-3">
              {branding?.logoUrl ? (
                <img
                  alt=""
                  className="h-10 w-10 rounded-md object-contain"
                  src={branding.logoUrl}
                />
              ) : null}
              <h1 className="text-2xl font-bold">{menu.tenant.name}</h1>
            </div>
          </div>
          <span className="rounded-md bg-leaf px-3 py-2 text-sm font-semibold text-white">
            {menu.tenant.isOpen ? "Aberto" : "Fechado"}
          </span>
        </div>
      </header>

      <div
        className={`public-menu-shell mx-auto grid max-w-5xl gap-6 px-4 py-6 ${
          orderingEnabled ? "lg:grid-cols-[1fr_360px]" : ""
        }`}
      >
        <section className="public-menu-categories space-y-8">
          {branding?.bodyImageUrl ? (
            <img
              alt=""
              className="max-h-80 w-full rounded-md border border-orange-100 object-cover"
              src={branding.bodyImageUrl}
            />
          ) : null}
          {!orderingEnabled ? (
            <div className="rounded-md border border-orange-100 bg-white p-4 text-sm text-slate-700">
              Este cardapio esta em modo consulta. Entre em contato com a loja para fazer pedidos.
            </div>
          ) : null}
          {menu.categories.map((category) => (
            <section key={category.id}>
              <h2 className="text-xl font-semibold">{category.name}</h2>
              <div className="public-menu-product-list mt-3 divide-y divide-orange-100 rounded-md border border-orange-100 bg-white">
                {category.products.map((product) => (
                  <article
                    key={product.id}
                    className="public-menu-product grid grid-cols-[1fr_auto] items-center gap-4 p-4"
                  >
                    <div className="grid min-w-0 gap-3 sm:grid-cols-[auto_1fr]">
                      {showProductImages && product.imageUrl ? (
                        <img
                          alt=""
                          className="h-20 w-20 rounded-md object-cover"
                          src={product.imageUrl}
                        />
                      ) : null}
                      <div>
                        <h3 className="font-semibold">{product.name}</h3>
                        {showProductDescriptions && product.description ? (
                          <p className="mt-1 text-sm text-slate-600">{product.description}</p>
                        ) : null}
                        <p className="mt-2 font-semibold" style={{ color: primaryColor }}>
                          R$ {product.price}
                        </p>
                      </div>
                    </div>
                    {orderingEnabled ? (
                      <button
                        className="rounded-md px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
                        disabled={!canOrder}
                        onClick={() => addProduct(product)}
                        style={{ backgroundColor: primaryColor }}
                        type="button"
                      >
                        Adicionar
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ))}
          {branding?.footerImageUrl ? (
            <img
              alt=""
              className="max-h-64 w-full rounded-md border border-orange-100 object-cover"
              src={branding.footerImageUrl}
            />
          ) : null}
        </section>

        {orderingEnabled ? (
          <aside className="public-menu-cart h-fit rounded-md border border-orange-100 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">Seu pedido</h2>

            <div className="mt-4 space-y-3">
              {cartLines.length === 0 ? (
                <p className="text-sm text-slate-600">Carrinho vazio.</p>
              ) : (
                cartLines.map((line) => (
                  <div key={line.product.id} className="grid grid-cols-[1fr_auto] gap-3">
                    <div>
                      <p className="font-medium">{line.product.name}</p>
                      <p className="text-sm text-slate-600">R$ {line.product.price}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="h-8 w-8 rounded-md border border-slate-200"
                        onClick={() => updateQuantity(line.product.id, line.quantity - 1)}
                        type="button"
                      >
                        -
                      </button>
                      <span className="w-6 text-center text-sm font-semibold">{line.quantity}</span>
                      <button
                        className="h-8 w-8 rounded-md border border-slate-200"
                        onClick={() => updateQuantity(line.product.id, line.quantity + 1)}
                        type="button"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
              <span className="font-semibold">Total estimado</span>
              <span className="font-bold" style={{ color: primaryColor }}>
                R$ {cartTotal.toFixed(2)}
              </span>
            </div>

            <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
              <input
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Nome"
                required
                value={customerName}
              />
              <input
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                onChange={(event) => setCustomerPhone(event.target.value)}
                placeholder="Telefone"
                required
                value={customerPhone}
              />
              <select
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                onChange={(event) => setFulfillmentMethod(event.target.value as FulfillmentMethod)}
                value={fulfillmentMethod}
              >
                <option value="DELIVERY">Delivery</option>
                <option value="PICKUP">Retirada</option>
              </select>
              {fulfillmentMethod === "DELIVERY" ? (
                <textarea
                  className="min-h-20 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  onChange={(event) => setDeliveryAddress(event.target.value)}
                  placeholder="Endereco de entrega"
                  required
                  value={deliveryAddress}
                />
              ) : null}
              <select
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                value={paymentMethod}
              >
                <option value="PIX_MANUAL">PIX</option>
                <option value="CASH">Dinheiro</option>
                <option value="CARD_ON_DELIVERY">Cartao na entrega</option>
              </select>
              <textarea
                className="min-h-16 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Observacoes"
                value={notes}
              />

              {error ? (
                <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
              ) : null}

              {createdOrder ? (
                <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
                  <p className="font-semibold">Pedido criado: R$ {createdOrder.total}</p>
                  <a
                    className="mt-2 inline-block font-semibold underline"
                    href={createdOrder.whatsappUrl}
                  >
                    Enviar resumo no WhatsApp
                  </a>
                </div>
              ) : null}

              <button
                className="w-full rounded-md px-4 py-3 text-sm font-semibold text-white disabled:bg-slate-300"
                disabled={submitting || !canOrder}
                style={{ backgroundColor: accentColor }}
                type="submit"
              >
                {submitting ? "Finalizando..." : "Finalizar pedido"}
              </button>
            </form>
          </aside>
        ) : null}
      </div>
    </main>
  );
}
