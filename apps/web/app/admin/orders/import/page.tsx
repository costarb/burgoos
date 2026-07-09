import { getAdminCatalog, listPaymentInstitutions } from "../../../../lib/api";
import { OrderImportClient } from "./order-import-client";

export const dynamic = "force-dynamic";

export default async function AdminOrderImportPage() {
  const { token, products } = await getAdminCatalog();
  const institutions = await listPaymentInstitutions(token, { active: "true" });

  return (
    <main className="min-h-screen bg-slate-50">
      <OrderImportClient institutions={institutions} products={products} token={token} />
    </main>
  );
}
