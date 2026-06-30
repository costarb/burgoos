import { getAdminCatalog } from "../../../lib/api";
import { CatalogClient } from "./catalog-client";

export const dynamic = "force-dynamic";

export default async function AdminCatalogPage() {
  const { token, categories, products, technicalSheets } = await getAdminCatalog();

  return (
    <CatalogClient
      initialCategories={categories}
      initialProducts={products}
      initialTechnicalSheets={technicalSheets}
      token={token}
    />
  );
}
