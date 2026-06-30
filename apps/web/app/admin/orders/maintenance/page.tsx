import type { OrderStatus } from "@burgoos/types";
import { getOrderMaintenanceHistory, getOrderMaintenanceSearch } from "../../../../lib/api";

interface MaintenancePageProps {
  searchParams?: {
    start?: string;
    end?: string;
    status?: string;
    includeDeleted?: string;
    search?: string;
  };
}

const statusLabels: Record<OrderStatus, string> = {
  PENDING: "Novo",
  PREPARING: "Preparando",
  SHIPPED: "Saiu",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};

export default async function OrderMaintenancePage({ searchParams = {} }: MaintenancePageProps) {
  const status = isOrderStatus(searchParams.status) ? searchParams.status : undefined;
  const result = await getOrderMaintenanceSearch({
    start: searchParams.start,
    end: searchParams.end,
    status,
    includeDeleted: searchParams.includeDeleted === "true",
    search: searchParams.search,
  });
  const histories = await Promise.all(
    result.orders.map((order) => getOrderMaintenanceHistory(result.token, order.id))
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 text-slate-900">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase text-tomato">Pedidos</p>
          <h1 className="mt-1 text-3xl font-semibold">Manutencao e auditoria</h1>
        </div>
        <a className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold" href="/admin/orders">
          Voltar para fila
        </a>
      </div>

      <form className="mt-6 grid gap-3 border-y border-slate-200 py-4 md:grid-cols-5">
        <input className="rounded-md border p-2 text-sm" defaultValue={searchParams.search} name="search" placeholder="ID, cliente ou pagamento" />
        <input className="rounded-md border p-2 text-sm" defaultValue={searchParams.start} name="start" type="date" />
        <input className="rounded-md border p-2 text-sm" defaultValue={searchParams.end} name="end" type="date" />
        <select className="rounded-md border p-2 text-sm" defaultValue={status ?? ""} name="status">
          <option value="">Todos os status</option>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input defaultChecked={searchParams.includeDeleted === "true"} name="includeDeleted" type="checkbox" value="true" />
            Excluidos
          </label>
          <button className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white" type="submit">Buscar</button>
        </div>
      </form>

      <section className="mt-6 space-y-3">
        {result.orders.length === 0 ? <p className="text-sm text-slate-500">Nenhum pedido encontrado.</p> : null}
        {result.orders.map((order, index) => (
          <article className="rounded-md border border-slate-200 bg-white p-4" key={order.id}>
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <p className="font-semibold">{order.customerName}</p>
                <p className="text-xs text-slate-500">{order.id}</p>
              </div>
              <div className="text-right text-sm">
                <p>{statusLabels[order.status]}{order.deletedAt ? " · Excluido" : ""}</p>
                <p className="font-semibold">R$ {order.total}</p>
              </div>
            </div>
            {order.deletionReason ? <p className="mt-3 rounded-md bg-red-50 p-2 text-sm text-red-700">Motivo da exclusao: {order.deletionReason}</p> : null}
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold">Historico de manutencoes ({histories[index]?.length ?? 0})</summary>
              <ul className="mt-2 space-y-2">
                {histories[index]?.map((record) => (
                  <li className="border-l-2 border-slate-300 pl-3 text-sm" key={record.id}>
                    <strong>{record.action === "EDIT" ? "Alteracao" : "Exclusao"}</strong>
                    <span className="ml-2 text-xs text-slate-500">{new Date(record.createdAt).toLocaleString("pt-BR")} por {record.actorName}</span>
                    <p>{record.reason}</p>
                  </li>
                ))}
              </ul>
            </details>
          </article>
        ))}
      </section>
    </main>
  );
}

function isOrderStatus(value?: string): value is OrderStatus {
  return ["PENDING", "PREPARING", "SHIPPED", "DELIVERED", "CANCELLED"].includes(value ?? "");
}
