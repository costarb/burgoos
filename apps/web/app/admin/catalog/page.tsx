import { getAdminCatalog } from "../../../lib/api";
import { CatalogClient } from "./catalog-client";

export const dynamic = "force-dynamic";

export default async function AdminCatalogPage() {
  const { token, categories, products } = await getAdminCatalog();

  return <CatalogClient token={token} initialCategories={categories} initialProducts={products} />;
}
