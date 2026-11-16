import React from "react";
import { getAdminToken, listPaymentInstitutions, listProductOptions } from "../../../../lib/api";
import { OrderImportClient } from "./order-import-client";

export const dynamic = "force-dynamic";

/**
 * Loads only what the screen uses: product options (id, name, price) and active payment
 * institutions. The full catalog (images, categories, technical sheets) made this page slow and
 * pushed the API memory up on the first access of the day (spec 030).
 */
export default async function AdminOrderImportPage() {
  const token = await getAdminToken();
  const [products, institutions] = await Promise.all([
    listProductOptions(token, { active: true }),
    listPaymentInstitutions(token, { active: "true" }),
  ]);

  return (
    <main className="min-h-screen bg-slate-50">
      <OrderImportClient institutions={institutions} products={products} token={token} />
    </main>
  );
}
