import {
  getCounterOrder,
  getPendingPaymentOrders,
  getPosCatalog,
  getServiceTabs,
} from "../../../lib/api";
import { PosClient } from "./pos-client";

export default async function PosPage({
  searchParams = {},
}: {
  searchParams?: { tabId?: string; orderId?: string };
}) {
  const [catalog, tabs, initialOrder, pendingPayments] = await Promise.all([
    getPosCatalog(),
    getServiceTabs(),
    searchParams.orderId ? getCounterOrder(searchParams.orderId) : Promise.resolve(undefined),
    getPendingPaymentOrders(),
  ]);
  const initialServiceTabId = tabs.some(
    (tab) => tab.id === searchParams.tabId && tab.status === "OPEN",
  )
    ? searchParams.tabId
    : undefined;
  return (
    <PosClient
      catalog={catalog}
      initialOrder={initialOrder}
      initialServiceTabId={initialServiceTabId}
      initialTabs={tabs}
      initialPendingPayments={pendingPayments}
    />
  );
}
