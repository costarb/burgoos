interface OrderConfirmationPageProps {
  params: {
    slug: string;
    orderId: string;
  };
  searchParams: {
    total?: string;
    whatsappUrl?: string;
  };
}

export const dynamic = "force-dynamic";

export default function OrderConfirmationPage({
  params,
  searchParams
}: OrderConfirmationPageProps) {
  const total = searchParams.total ?? "0.00";
  const whatsappUrl = searchParams.whatsappUrl ?? `/${params.slug}`;

  return (
    <main className="min-h-screen bg-cream px-4 py-8 text-ink">
      <section className="mx-auto max-w-xl rounded-md border border-orange-100 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase text-tomato">Pedido criado</p>
        <h1 className="mt-2 text-3xl font-bold">Total R$ {total}</h1>
        <p className="mt-3 text-sm text-slate-600">
          Pedido {params.orderId}. Envie o resumo para a loja pelo WhatsApp para concluir o
          atendimento manual do piloto.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <a
            className="rounded-md bg-leaf px-4 py-3 text-center text-sm font-semibold text-white"
            href={whatsappUrl}
          >
            Enviar no WhatsApp
          </a>
          <a
            className="rounded-md border border-slate-200 px-4 py-3 text-center text-sm font-semibold"
            href={`/${params.slug}`}
          >
            Voltar ao cardapio
          </a>
        </div>
      </section>
    </main>
  );
}
