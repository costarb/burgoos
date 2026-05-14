import { getAdminOrderQueue } from "../../../lib/api";
import { OrdersClient } from "./orders-client";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const { apiUrl, token, tenant, activeOrders, historyOrders } = await getAdminOrderQueue();

  return (
    <main className="min-h-screen bg-slate-50">
      <OrdersClient
        apiUrl={apiUrl}
        initialActiveOrders={activeOrders}
        initialHistoryOrders={historyOrders}
        tenantId={tenant.id}
        token={token}
      />
    </main>
  );
}
