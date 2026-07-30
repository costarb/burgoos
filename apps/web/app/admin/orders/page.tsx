import { getAdminOrderQueue, getKdsOrders } from "../../../lib/api";
import { KdsClient } from "./kds-client";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const [{ apiUrl, token, tenant, historyOrders }, activeOrders] = await Promise.all([
    getAdminOrderQueue(),
    getKdsOrders(),
  ]);

  return (
    <main className="min-h-screen bg-slate-50">
      <KdsClient
        apiUrl={apiUrl}
        initialActiveOrders={activeOrders}
        initialHistoryOrders={historyOrders}
        tenantId={tenant.id}
        token={token}
      />
    </main>
  );
}
