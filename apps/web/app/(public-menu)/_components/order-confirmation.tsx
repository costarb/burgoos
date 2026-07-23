import React from "react";

export function OrderConfirmation({
  orderId,
  total,
  whatsappUrl,
  menuHref,
}: {
  orderId: string;
  total: string;
  whatsappUrl: string;
  menuHref: string;
}) {
  return (
    <main className="min-h-screen bg-cream px-4 py-8 text-ink">
      <section className="mx-auto max-w-xl rounded-md border border-orange-100 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase text-tomato">Pedido criado</p>
        <h1 className="mt-2 text-3xl font-bold">Total R$ {total}</h1>
        <p className="mt-3 text-sm text-slate-600">
          Pedido {orderId}. Envie o resumo para a loja pelo WhatsApp para concluir o atendimento.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <a className="rounded-md bg-leaf px-4 py-3 text-center text-sm font-semibold text-white" href={whatsappUrl}>Enviar no WhatsApp</a>
          <a className="rounded-md border border-slate-200 px-4 py-3 text-center text-sm font-semibold" href={menuHref}>Voltar ao cardapio</a>
        </div>
      </section>
    </main>
  );
}
