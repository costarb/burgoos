"use client";

import { CSSProperties, FormEvent, useEffect, useMemo, useState } from "react";
import { Globe } from "lucide-react";
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
  navigationBase?: string;
}

const cartStorageKey = "burgoos:cart";

export function PublicMenuClient({ menu, navigationBase }: PublicMenuClientProps) {
  const branding = menu.tenant.branding;
  const primaryColor = branding?.primaryColor ?? "#C92A2A";
  const accentColor = branding?.accentColor ?? "#F59F00";
  const layoutPreset = branding?.layoutPreset ?? "classic";
  const showProductImages = branding?.showProductImages ?? false;
  const showProductDescriptions = branding?.showProductDescriptions ?? false;
  const orderingEnabled = branding?.orderingEnabled ?? true;
  const publicAddress = formatAddress(menu.tenant.address);
  const socialLinks = publicSocialLinks(menu.tenant.socialLinks);
  const canOrder = menu.tenant.isOpen && orderingEnabled;
  const router = useRouter();
  const menuBase = navigationBase ?? `/${menu.tenant.slug}`;
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
      router.push(orderConfirmationPath(menuBase, order));
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
      <header
        className="border-b border-orange-100 bg-white bg-cover bg-center px-4 py-8 shadow-sm"
        style={backgroundStyle(branding?.headerImageUrl, "header")}
      >
        <div
          className={`mx-auto flex max-w-5xl items-center justify-between gap-4 rounded-md ${
            branding?.headerImageUrl ? "bg-white/85 p-4 shadow-sm backdrop-blur-sm" : ""
          }`}
        >
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

      <section
        className="bg-cream bg-cover bg-center"
        style={backgroundStyle(branding?.bodyImageUrl)}
      >
        <div
          className={`public-menu-shell mx-auto grid max-w-5xl gap-6 px-4 py-8 ${
            orderingEnabled ? "lg:grid-cols-[1fr_360px]" : ""
          }`}
        >
          <section className="public-menu-categories space-y-8">
            {!orderingEnabled ? (
              <div className="rounded-md border border-orange-100 bg-white/95 p-4 text-sm text-slate-700 shadow-sm">
                Este cardapio esta em modo consulta. Entre em contato com a loja para fazer pedidos.
              </div>
            ) : null}
            {menu.categories.map((category) => (
              <section key={category.id}>
                <h2 className="text-xl font-semibold">{category.name}</h2>
                <div className="public-menu-product-list mt-3 divide-y divide-orange-100 rounded-md border border-orange-100 bg-white/95 shadow-sm">
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
          </section>

          {orderingEnabled ? (
            <aside className="public-menu-cart h-fit rounded-md border border-orange-100 bg-white/95 p-4 shadow-sm">
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
                        <span className="w-6 text-center text-sm font-semibold">
                          {line.quantity}
                        </span>
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
                  onChange={(event) =>
                    setFulfillmentMethod(event.target.value as FulfillmentMethod)
                  }
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
      </section>

      <footer
        className="bg-white bg-cover bg-center px-4 py-8"
        style={backgroundStyle(branding?.footerImageUrl, "footer")}
      >
        <div
          className={`mx-auto grid max-w-5xl gap-4 text-sm text-slate-600 md:grid-cols-[1fr_auto] ${
            branding?.footerImageUrl ? "rounded-md bg-white/80 p-4 shadow-sm backdrop-blur-sm" : ""
          }`}
        >
          <div>
            <p className="font-semibold text-slate-900">{menu.tenant.name}</p>
            <p>{menu.tenant.isOpen ? "Aberto para pedidos" : "Loja fechada no momento"}</p>
            {menu.tenant.phone ? <p className="mt-2">{menu.tenant.phone}</p> : null}
            {publicAddress ? <p className="mt-1">{publicAddress}</p> : null}
          </div>
          {socialLinks.length > 0 ? (
            <nav
              className="flex flex-wrap items-start gap-3 md:justify-end"
              aria-label="Midias sociais"
            >
              {socialLinks.map((link) => (
                <a
                  className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white/80 px-3 py-2 font-semibold text-slate-900 underline-offset-4 hover:underline"
                  href={link.href}
                  key={link.kind}
                  rel="noreferrer"
                  target="_blank"
                  title={link.label}
                >
                  <SocialIcon kind={link.kind} />
                  <span>{link.text}</span>
                </a>
              ))}
            </nav>
          ) : null}
        </div>
      </footer>
    </main>
  );
}

export function orderConfirmationPath(base: string, order: CreatedOrder): string {
  return `${base}/pedido/${order.id}?total=${order.total}&whatsappUrl=${encodeURIComponent(order.whatsappUrl)}`;
}

function formatAddress(address: PublicMenu["tenant"]["address"]): string | null {
  if (!address) {
    return null;
  }

  const streetLine = [address.street, address.number].filter(Boolean).join(", ");
  const complementLine = address.complement;
  const neighborhoodLine = address.neighborhood;
  const cityLine = [address.city, address.state].filter(Boolean).join(" / ");
  const postalCodeLine = address.postalCode;
  const lines = [streetLine, complementLine, neighborhoodLine, cityLine, postalCodeLine].filter(
    Boolean
  );

  return lines.length > 0 ? lines.join(" - ") : null;
}

function publicSocialLinks(
  socialLinks: PublicMenu["tenant"]["socialLinks"]
): Array<{ kind: SocialLinkKind; label: string; text: string; href: string }> {
  if (!socialLinks) {
    return [];
  }

  return [
    socialLink("instagram", "Instagram", socialLinks.instagram, true),
    socialLink("facebook", "Facebook", socialLinks.facebook, true),
    socialLink("whatsapp", "WhatsApp", socialLinks.whatsapp, true),
    socialLink("website", "Site", socialLinks.website, false),
  ].filter((link): link is NonNullable<typeof link> => Boolean(link));
}

type SocialLinkKind = "instagram" | "facebook" | "whatsapp" | "website";

function socialLink(
  kind: SocialLinkKind,
  label: string,
  value: string | null | undefined,
  useHandle: boolean
) {
  const href = normalizeExternalHref(value);

  if (!href) {
    return null;
  }

  const userText = extractLastUrlSegment(value ?? href);

  return {
    kind,
    label,
    href,
    text: useHandle ? `@${userText}` : userText,
  };
}

function SocialIcon({ kind }: { kind: SocialLinkKind }) {
  if (kind === "instagram") {
    return (
      <span
        aria-hidden
        className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-gradient-to-br from-fuchsia-600 via-rose-500 to-amber-400 text-white"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
          <rect height="16" rx="5" stroke="currentColor" strokeWidth="2" width="16" x="4" y="4" />
          <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="2" />
          <circle cx="16.5" cy="7.5" fill="currentColor" r="1.2" />
        </svg>
      </span>
    );
  }

  if (kind === "website") {
    return <Globe aria-hidden className="h-4 w-4 shrink-0" />;
  }

  const iconText: Record<Exclude<SocialLinkKind, "website" | "instagram">, string> = {
    facebook: "f",
    whatsapp: "WA",
  };

  return (
    <span
      aria-hidden
      className="grid h-5 min-w-5 shrink-0 place-items-center rounded-sm bg-slate-900 px-1 text-[10px] font-bold leading-none text-white"
    >
      {iconText[kind]}
    </span>
  );
}

function normalizeExternalHref(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function extractLastUrlSegment(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  let candidate = trimmed;

  try {
    const url = new URL(normalizeExternalHref(trimmed) ?? trimmed);
    const pathToken = url.pathname.split("/").filter(Boolean).pop();
    candidate = pathToken || url.hostname.replace(/^www\./i, "");
  } catch {
    candidate = trimmed.split(/[?#]/)[0].split("/").filter(Boolean).pop() ?? trimmed;
  }

  const decoded = decodeURIComponent(candidate).replace(/^@/, "").trim();
  return decoded || trimmed;
}

function backgroundStyle(
  imageUrl: string | null | undefined,
  area?: "header" | "footer"
): CSSProperties | undefined {
  if (!imageUrl) {
    return undefined;
  }

  return {
    backgroundImage: `url("${imageUrl}")`,
    ...(area === "header" ? { minHeight: "clamp(220px, 25vw, 480px)" } : {}),
    ...(area === "footer" ? { minHeight: "clamp(140px, 16.6667vw, 320px)" } : {}),
  };
}
