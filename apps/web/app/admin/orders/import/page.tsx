import { getAdminCatalog } from "../../../../lib/api";
import { OrderImportClient } from "./order-import-client";

export const dynamic = "force-dynamic";

export default async function AdminOrderImportPage() {
  const { token, products } = await getAdminCatalog();

  return (
    <main className="min-h-screen bg-slate-50">
      <OrderImportClient products={products} token={token} />
    </main>
  );
}
