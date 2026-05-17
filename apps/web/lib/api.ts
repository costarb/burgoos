import type {
  AdminOrder,
  CreatedOrder,
  CreatePublicOrderInput,
  FinancialConfiguration,
  FinancialConfigurationInput,
  FinancialDashboardIndicators,
  FinancialDreSummary,
  Ingredient,
  IngredientInput,
  InventoryBalance,
  MenuEngineeringReport,
  OrderPlatform,
  OrderPlatformInput,
  OrderStatus,
  ProductPricing,
  PurchaseUnit,
  PurchaseUnitInput,
  PublicMenu,
  Supplier,
  SupplierInput,
  StockMovementInput,
  TechnicalSheet,
  TechnicalSheetInput,
  TechnicalSheetSummary,
} from "@burgoos/types";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface AdminCategory {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
}

export interface CreateAdminCategoryInput {
  name: string;
  sortOrder?: number;
  active?: boolean;
}

export interface AdminProduct {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: string;
  imageUrl: string | null;
  active: boolean;
}

export interface CreateAdminProductInput {
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  active?: boolean;
}

export interface AdminTenant {
  id: string;
  name: string;
  slug: string;
  isOpen: boolean;
}

export interface DailySummary {
  date: string;
  orderCount: number;
  grossRevenue: string;
}

async function fetchAdmin<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(error?.message ?? "Falha na requisicao administrativa");
  }

  return response.json() as Promise<T>;
}

export async function getPublicMenu(slug: string): Promise<PublicMenu | null> {
  const response = await fetch(`${apiUrl}/api/public/tenants/${slug}/menu`, {
    next: {
      revalidate: 30,
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to load public menu");
  }

  return response.json() as Promise<PublicMenu>;
}

export async function createPublicOrder(
  slug: string,
  payload: CreatePublicOrderInput
): Promise<CreatedOrder> {
  const response = await fetch(`${apiUrl}/api/public/tenants/${slug}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(error?.message ?? "Nao foi possivel finalizar o pedido");
  }

  return response.json() as Promise<CreatedOrder>;
}

export async function loginAdmin(email: string, password: string): Promise<string> {
  const response = await fetch(`${apiUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to login admin");
  }

  const data = (await response.json()) as { accessToken: string };
  return data.accessToken;
}

export async function getAdminToken(): Promise<string> {
  return loginAdmin(
    process.env.DEMO_ADMIN_EMAIL ?? "admin@burgoos.local",
    process.env.DEMO_ADMIN_PASSWORD ?? "admin123"
  );
}

export async function getAdminCatalog(): Promise<{
  token: string;
  categories: AdminCategory[];
  products: AdminProduct[];
  technicalSheets: TechnicalSheetSummary[];
}> {
  const token = await getAdminToken();

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  const [categoriesResponse, productsResponse, technicalSheetsResponse] = await Promise.all([
    fetch(`${apiUrl}/api/admin/categories`, { headers, cache: "no-store" }),
    fetch(`${apiUrl}/api/admin/products`, { headers, cache: "no-store" }),
    fetch(`${apiUrl}/api/admin/technical-sheets`, { headers, cache: "no-store" }),
  ]);

  if (!categoriesResponse.ok || !productsResponse.ok || !technicalSheetsResponse.ok) {
    throw new Error("Failed to load admin catalog");
  }

  return {
    token,
    categories: (await categoriesResponse.json()) as AdminCategory[],
    products: (await productsResponse.json()) as AdminProduct[],
    technicalSheets: (await technicalSheetsResponse.json()) as TechnicalSheetSummary[],
  };
}

export async function createAdminCategory(
  token: string,
  payload: CreateAdminCategoryInput
): Promise<AdminCategory> {
  const response = await fetch(`${apiUrl}/api/admin/categories`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(error?.message ?? "Nao foi possivel criar a categoria");
  }

  return response.json() as Promise<AdminCategory>;
}

export async function createAdminProduct(
  token: string,
  payload: CreateAdminProductInput
): Promise<AdminProduct> {
  const response = await fetch(`${apiUrl}/api/admin/products`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(error?.message ?? "Nao foi possivel criar o produto");
  }

  return response.json() as Promise<AdminProduct>;
}

export async function getAdminOrderQueue(): Promise<{
  token: string;
  apiUrl: string;
  tenant: AdminTenant;
  activeOrders: AdminOrder[];
  historyOrders: AdminOrder[];
}> {
  const token = await getAdminToken();
  const headers = {
    Authorization: `Bearer ${token}`,
  };

  const [tenantResponse, activeResponse, historyResponse] = await Promise.all([
    fetch(`${apiUrl}/api/admin/tenant`, { headers, cache: "no-store" }),
    fetch(`${apiUrl}/api/admin/orders`, { headers, cache: "no-store" }),
    fetch(`${apiUrl}/api/admin/orders?history=true`, { headers, cache: "no-store" }),
  ]);

  if (!tenantResponse.ok || !activeResponse.ok || !historyResponse.ok) {
    throw new Error("Failed to load admin orders");
  }

  return {
    token,
    apiUrl,
    tenant: (await tenantResponse.json()) as AdminTenant,
    activeOrders: (await activeResponse.json()) as AdminOrder[],
    historyOrders: (await historyResponse.json()) as AdminOrder[],
  };
}

export async function updateAdminOrderStatus(
  token: string,
  orderId: string,
  status: OrderStatus
): Promise<AdminOrder> {
  const response = await fetch(`${apiUrl}/api/admin/orders/${orderId}/status`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
    cache: "no-store",
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(error?.message ?? "Nao foi possivel atualizar o pedido");
  }

  return response.json() as Promise<AdminOrder>;
}

export async function getAdminDailySummary(): Promise<DailySummary> {
  const token = await getAdminToken();
  const response = await fetch(`${apiUrl}/api/admin/reports/daily-summary`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load daily summary");
  }

  return response.json() as Promise<DailySummary>;
}

export async function getFinancialDashboard(): Promise<FinancialDashboardIndicators> {
  const token = await getAdminToken();
  return fetchAdmin<FinancialDashboardIndicators>(token, "/api/admin/reports/financial/dashboard");
}

export async function getFinancialDre(start?: string, end?: string): Promise<FinancialDreSummary> {
  const token = await getAdminToken();
  const params = new URLSearchParams();

  if (start) {
    params.set("start", start);
  }

  if (end) {
    params.set("end", end);
  }

  const query = params.toString();
  return fetchAdmin<FinancialDreSummary>(
    token,
    `/api/admin/reports/financial/dre${query ? `?${query}` : ""}`
  );
}

export async function getMenuEngineeringReport(
  dateFrom?: string,
  dateTo?: string
): Promise<MenuEngineeringReport> {
  const token = await getAdminToken();
  const params = new URLSearchParams();

  if (dateFrom) {
    params.set("dateFrom", dateFrom);
  }

  if (dateTo) {
    params.set("dateTo", dateTo);
  }

  const query = params.toString();
  return fetchAdmin<MenuEngineeringReport>(
    token,
    `/api/admin/reports/menu-engineering${query ? `?${query}` : ""}`
  );
}

export async function getFinancialConfiguration(): Promise<FinancialConfiguration> {
  const token = await getAdminToken();
  return fetchAdmin<FinancialConfiguration>(token, "/api/admin/financial/config");
}

export async function updateFinancialConfiguration(
  token: string,
  payload: FinancialConfigurationInput
): Promise<FinancialConfiguration> {
  return fetchAdmin<FinancialConfiguration>(token, "/api/admin/financial/config", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getPurchaseUnits(): Promise<{
  token: string;
  purchaseUnits: PurchaseUnit[];
}> {
  const token = await getAdminToken();
  const purchaseUnits = await fetchAdmin<PurchaseUnit[]>(token, "/api/admin/purchase-units");
  return { token, purchaseUnits };
}

export async function createPurchaseUnit(
  token: string,
  payload: PurchaseUnitInput
): Promise<PurchaseUnit> {
  return fetchAdmin<PurchaseUnit>(token, "/api/admin/purchase-units", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updatePurchaseUnit(
  token: string,
  id: string,
  payload: PurchaseUnitInput
): Promise<PurchaseUnit> {
  return fetchAdmin<PurchaseUnit>(token, `/api/admin/purchase-units/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function getSuppliers(): Promise<{
  token: string;
  suppliers: Supplier[];
}> {
  const token = await getAdminToken();
  const suppliers = await fetchAdmin<Supplier[]>(token, "/api/admin/suppliers");
  return { token, suppliers };
}

export async function createSupplier(token: string, payload: SupplierInput): Promise<Supplier> {
  return fetchAdmin<Supplier>(token, "/api/admin/suppliers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateSupplier(
  token: string,
  id: string,
  payload: SupplierInput
): Promise<Supplier> {
  return fetchAdmin<Supplier>(token, `/api/admin/suppliers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function getOrderPlatforms(): Promise<{
  token: string;
  orderPlatforms: OrderPlatform[];
}> {
  const token = await getAdminToken();
  const orderPlatforms = await fetchAdmin<OrderPlatform[]>(token, "/api/admin/order-platforms");
  return { token, orderPlatforms };
}

export async function createOrderPlatform(
  token: string,
  payload: OrderPlatformInput
): Promise<OrderPlatform> {
  return fetchAdmin<OrderPlatform>(token, "/api/admin/order-platforms", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateOrderPlatform(
  token: string,
  id: string,
  payload: OrderPlatformInput
): Promise<OrderPlatform> {
  return fetchAdmin<OrderPlatform>(token, `/api/admin/order-platforms/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function getIngredients(): Promise<{
  token: string;
  ingredients: Ingredient[];
  purchaseUnits: PurchaseUnit[];
  suppliers: Supplier[];
}> {
  const token = await getAdminToken();
  const [ingredients, purchaseUnits, suppliers] = await Promise.all([
    fetchAdmin<Ingredient[]>(token, "/api/admin/ingredients"),
    fetchAdmin<PurchaseUnit[]>(token, "/api/admin/purchase-units"),
    fetchAdmin<Supplier[]>(token, "/api/admin/suppliers"),
  ]);

  return { token, ingredients, purchaseUnits, suppliers };
}

export async function createIngredient(
  token: string,
  payload: IngredientInput
): Promise<Ingredient> {
  return fetchAdmin<Ingredient>(token, "/api/admin/ingredients", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateIngredient(
  token: string,
  id: string,
  payload: IngredientInput
): Promise<Ingredient> {
  return fetchAdmin<Ingredient>(token, `/api/admin/ingredients/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function getTechnicalSheet(token: string, productId: string): Promise<TechnicalSheet> {
  return fetchAdmin<TechnicalSheet>(token, `/api/admin/products/${productId}/technical-sheet`);
}

export async function replaceTechnicalSheet(
  token: string,
  productId: string,
  payload: TechnicalSheetInput
): Promise<TechnicalSheet> {
  return fetchAdmin<TechnicalSheet>(token, `/api/admin/products/${productId}/technical-sheet`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getPricingAnalysis(platformId?: string): Promise<{
  orderPlatforms: OrderPlatform[];
  selectedPlatformId: string;
  products: ProductPricing[];
}> {
  const token = await getAdminToken();
  const orderPlatforms = await fetchAdmin<OrderPlatform[]>(token, "/api/admin/order-platforms");
  const selectedPlatformId =
    platformId ?? orderPlatforms.find((platform) => platform.active)?.id ?? "";
  const query = selectedPlatformId ? `?platformId=${selectedPlatformId}` : "";
  const products = await fetchAdmin<ProductPricing[]>(token, `/api/admin/pricing/products${query}`);

  return {
    orderPlatforms,
    selectedPlatformId,
    products,
  };
}

export async function getInventoryBalances(): Promise<{
  token: string;
  balances: InventoryBalance[];
  ingredients: Ingredient[];
}> {
  const token = await getAdminToken();
  const [balances, ingredients] = await Promise.all([
    fetchAdmin<InventoryBalance[]>(token, "/api/admin/inventory/balances"),
    fetchAdmin<Ingredient[]>(token, "/api/admin/ingredients"),
  ]);

  return { token, balances, ingredients };
}

export async function createStockMovement(
  token: string,
  payload: StockMovementInput
): Promise<void> {
  await fetchAdmin<unknown>(token, "/api/admin/inventory/movements", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
