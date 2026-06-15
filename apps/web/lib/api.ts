import type {
  AdminOrder,
  AccessProfileSummary,
  AccessStoreSummary,
  AccessUserDetail,
  AccessProfileDetail,
  AccessPermissionGroup,
  AccessAuditEvent,
  DeleteOrderInput,
  DeliveryIntegrationDetail,
  DeliveryIntegrationHealth,
  DeliveryIntegrationStatus,
  EditOrderInput,
  BrandingDraftInput,
  BrandingPreview,
  BrandingState,
  CreatedOrder,
  CreatePublicOrderInput,
  CreateStoreInput,
  FinancialConfiguration,
  FinancialAccount,
  FinancialAccountInput,
  FinancialCategory,
  FinancialCategoryInput,
  FinancialConfigurationInput,
  FinancialDashboardIndicators,
  FinancialDreSummary,
  FinancialAuditRecord,
  CashLedgerEntry,
  CashMovement,
  CashMovementInput,
  CashPosition,
  CashStatement,
  Payable,
  PayableInput,
  PayableOptions,
  PayablePaymentInput,
  PayablesResponse,
  HistoricalOrderImportInput,
  HistoricalOrderImportResult,
  Ingredient,
  IngredientInput,
  InventoryBalance,
  MenuEngineeringReport,
  OrderPlatform,
  OrderPlatformInput,
  OrderMaintenanceRecord,
  OrderStatus,
  ProductPricing,
  PurchaseUnit,
  PurchaseUnitInput,
  PublicMenu,
  SalesReportFilters,
  SalesReportResponse,
  StoreDetail,
  StoreSetupResult,
  StoreSummary,
  Supplier,
  SupplierInput,
  StockMovementInput,
  TechnicalSheet,
  TechnicalSheetInput,
  TechnicalSheetSummary,
  UpdateStoreInput,
  VisualConfiguration,
} from "@burgoos/types";
import { clearAuthSession, readAuthSession } from "./auth-client";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";
const AUTH_ACCESS_COOKIE = "burgoos.admin.access_token";

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

export interface AccessUsersOptions {
  stores: AccessStoreSummary[];
  profiles: AccessProfileSummary[];
}

export interface AccessUserPayload {
  login: string;
  name: string;
  email: string;
  phone?: string | null;
  isMaster: boolean;
  assignments: Array<{
    storeId: string;
    profileId: string;
    canManageStoreAccess: boolean;
    status: "ACTIVE" | "INACTIVE";
  }>;
}

export interface FirstAccessIssue {
  token: string;
  expiresAt: string;
  setupUrl: string;
}

export interface AccessProfilePayload {
  name: string;
  description?: string | null;
  scope: "GLOBAL" | "STORE";
  storeId?: string | null;
  permissionKeys: string[];
}

export interface DeliveryIntegrationPayload {
  provider: "IFOOD";
  displayName: string;
  externalMerchantId?: string | null;
  orderPlatformId: string;
  pollingEnabled?: boolean;
  webhookEnabled?: boolean;
}

export interface DeliveryCredentialPayload {
  clientId: string;
  clientSecret: string;
  authorizationCode?: string | null;
  refreshToken?: string | null;
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
    const error = (await response.json().catch(() => null)) as {
      message?: string | string[];
      error?: string;
    } | null;
    const message = Array.isArray(error?.message)
      ? error.message.join("; ")
      : (error?.message ?? error?.error ?? "Falha na requisicao administrativa");

    console.error("Admin API request failed", {
      path,
      status: response.status,
      message,
    });

    if (response.status === 401) {
      await clearStoredAuthSession();
      await redirectToLogin();
    }

    throw new Error(`[${response.status}] ${path}: ${message}`);
  }

  return response.json() as Promise<T>;
}

async function fetchPlatform<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  return fetchAdmin<T>(token, path, init);
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

export async function loginPlatformAdmin(email: string, password: string): Promise<string> {
  const response = await fetch(`${apiUrl}/api/auth/platform/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to login platform admin");
  }

  const data = (await response.json()) as { accessToken: string };
  return data.accessToken;
}

export async function getAdminToken(): Promise<string> {
  return requireSessionAccessToken();
}

export async function getPlatformAdminToken(): Promise<string> {
  return requireSessionAccessToken();
}

async function readSessionAccessToken(): Promise<string | null> {
  if (typeof window !== "undefined") {
    return readAuthSession()?.accessToken ?? null;
  }

  try {
    const { cookies } = await import("next/headers");
    return cookies().get(AUTH_ACCESS_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

async function requireSessionAccessToken(): Promise<string> {
  const sessionToken = await readSessionAccessToken();

  if (sessionToken) {
    return sessionToken;
  }

  await redirectToLogin();
  throw new Error("Sessao administrativa ausente");
}

async function redirectToLogin(): Promise<void> {
  if (typeof window !== "undefined") {
    window.location.assign("/login");
    return;
  }

  const { redirect } = await import("next/navigation");
  redirect("/login");
}

async function clearStoredAuthSession(): Promise<void> {
  if (typeof window !== "undefined") {
    clearAuthSession();
    return;
  }

  try {
    const { cookies } = await import("next/headers");
    cookies().set(AUTH_ACCESS_COOKIE, "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
    });
  } catch {
    // Server components may be rendered in contexts where cookies cannot be mutated.
  }
}

export async function getAccessUsers(): Promise<{
  token: string;
  users: AccessUserDetail[];
  options: AccessUsersOptions;
}> {
  const token = await getAdminToken();
  const [users, options] = await Promise.all([
    fetchAdmin<AccessUserDetail[]>(token, "/api/admin/access/users"),
    fetchAdmin<AccessUsersOptions>(token, "/api/admin/access/users/options"),
  ]);

  return { token, users, options };
}

export async function createAccessUser(
  token: string,
  payload: AccessUserPayload
): Promise<AccessUserDetail> {
  return fetchAdmin<AccessUserDetail>(token, "/api/admin/access/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAccessUser(
  token: string,
  id: string,
  payload: Partial<AccessUserPayload> & { status?: "INVITED" | "ACTIVE" | "INACTIVE" | "LOCKED" }
): Promise<AccessUserDetail> {
  return fetchAdmin<AccessUserDetail>(token, `/api/admin/access/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function issueFirstAccessLink(token: string, id: string): Promise<FirstAccessIssue> {
  return fetchAdmin<FirstAccessIssue>(token, `/api/admin/access/users/${id}/first-access`, {
    method: "POST",
  });
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  const response = await fetch(`${apiUrl}/api/auth/password-reset/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token, newPassword }),
    cache: "no-store",
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(error?.message ?? "Link invalido, expirado ou senha fora do padrao.");
  }
}

export async function getAccessProfiles(): Promise<{
  token: string;
  profiles: AccessProfileDetail[];
  permissions: AccessPermissionGroup[];
  stores: AccessStoreSummary[];
}> {
  const token = await getAdminToken();
  const [profiles, permissions, userOptions] = await Promise.all([
    fetchAdmin<AccessProfileDetail[]>(token, "/api/admin/access/profiles"),
    fetchAdmin<AccessPermissionGroup[]>(token, "/api/admin/access/permissions"),
    fetchAdmin<AccessUsersOptions>(token, "/api/admin/access/users/options"),
  ]);

  return { token, profiles, permissions, stores: userOptions.stores };
}

export async function createAccessProfile(
  token: string,
  payload: AccessProfilePayload
): Promise<AccessProfileDetail> {
  return fetchAdmin<AccessProfileDetail>(token, "/api/admin/access/profiles", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAccessProfile(
  token: string,
  id: string,
  payload: Partial<AccessProfilePayload> & { status?: "ACTIVE" | "INACTIVE" }
): Promise<AccessProfileDetail> {
  return fetchAdmin<AccessProfileDetail>(token, `/api/admin/access/profiles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function duplicateAccessProfile(
  token: string,
  id: string,
  payload: { name: string; storeId?: string | null }
): Promise<AccessProfileDetail> {
  return fetchAdmin<AccessProfileDetail>(token, `/api/admin/access/profiles/${id}/duplicate`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getAccessAudit(
  filters: {
    storeId?: string;
    eventType?: string;
    targetUserId?: string;
    start?: string;
    end?: string;
  } = {}
): Promise<{
  token: string;
  events: AccessAuditEvent[];
  stores: AccessStoreSummary[];
}> {
  const token = await getAdminToken();
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  const [events, userOptions] = await Promise.all([
    fetchAdmin<AccessAuditEvent[]>(token, `/api/admin/access/audit${query ? `?${query}` : ""}`),
    fetchAdmin<AccessUsersOptions>(token, "/api/admin/access/users/options"),
  ]);

  return { token, events, stores: userOptions.stores };
}

export async function listPlatformStores(token: string): Promise<StoreSummary[]> {
  return fetchPlatform<StoreSummary[]>(token, "/api/platform/stores");
}

export async function createPlatformStore(
  token: string,
  payload: CreateStoreInput
): Promise<StoreSetupResult> {
  return fetchPlatform<StoreSetupResult>(token, "/api/platform/stores", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getPlatformStore(token: string, storeId: string): Promise<StoreDetail> {
  return fetchPlatform<StoreDetail>(token, `/api/platform/stores/${storeId}`);
}

export async function updatePlatformStore(
  token: string,
  storeId: string,
  payload: UpdateStoreInput
): Promise<StoreDetail> {
  return fetchPlatform<StoreDetail>(token, `/api/platform/stores/${storeId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function getBrandingState(token: string): Promise<BrandingState> {
  return fetchAdmin<BrandingState>(token, "/api/admin/store/branding");
}

export async function saveBrandingDraft(
  token: string,
  payload: BrandingDraftInput
): Promise<BrandingState["draft"]> {
  return fetchAdmin<BrandingState["draft"]>(token, "/api/admin/store/branding", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function previewBranding(
  token: string,
  payload: BrandingDraftInput
): Promise<BrandingPreview> {
  return fetchAdmin<BrandingPreview>(token, "/api/admin/store/branding/preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function publishBranding(token: string): Promise<VisualConfiguration> {
  return fetchAdmin<VisualConfiguration>(token, "/api/admin/store/branding/publish", {
    method: "POST",
  });
}

export async function getBrandingHistory(token: string): Promise<VisualConfiguration[]> {
  return fetchAdmin<VisualConfiguration[]>(token, "/api/admin/store/branding/history");
}

export async function restoreBranding(token: string): Promise<VisualConfiguration> {
  return fetchAdmin<VisualConfiguration>(token, "/api/admin/store/branding/restore", {
    method: "POST",
  });
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

export async function confirmPlatformOrder(token: string, orderId: string): Promise<AdminOrder> {
  return fetchAdmin<AdminOrder>(token, `/api/admin/orders/${orderId}/platform-actions/confirm`, {
    method: "POST",
  });
}

export async function refusePlatformOrder(
  token: string,
  orderId: string,
  payload: { providerReasonId: string; reason?: string }
): Promise<AdminOrder> {
  return fetchAdmin<AdminOrder>(token, `/api/admin/orders/${orderId}/platform-actions/refuse`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getPlatformCancellationReasons(
  token: string,
  orderId: string
): Promise<Array<{ id: string; description: string }>> {
  return fetchAdmin<Array<{ id: string; description: string }>>(
    token,
    `/api/admin/orders/${orderId}/platform-actions/cancellation-reasons`
  );
}

export async function editAdminOrder(
  token: string,
  orderId: string,
  payload: EditOrderInput
): Promise<AdminOrder> {
  return fetchAdmin<AdminOrder>(token, `/api/admin/orders/${orderId}/maintenance`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminOrder(
  token: string,
  orderId: string,
  payload: DeleteOrderInput
): Promise<{ orderId: string; deletedAt: string; reason: string }> {
  return fetchAdmin(token, `/api/admin/orders/${orderId}/maintenance`, {
    method: "DELETE",
    body: JSON.stringify(payload),
  });
}

export async function getOrderMaintenanceHistory(
  token: string,
  orderId: string
): Promise<OrderMaintenanceRecord[]> {
  return fetchAdmin<OrderMaintenanceRecord[]>(
    token,
    `/api/admin/orders/${orderId}/maintenance-history`
  );
}

export async function getOrderMaintenanceSearch(filters: {
  start?: string;
  end?: string;
  status?: OrderStatus;
  includeDeleted?: boolean;
  search?: string;
}): Promise<{ token: string; orders: AdminOrder[] }> {
  const token = await getAdminToken();
  const params = new URLSearchParams();
  if (filters.start) params.set("start", filters.start);
  if (filters.end) params.set("end", filters.end);
  if (filters.status) params.set("status", filters.status);
  if (filters.includeDeleted) params.set("includeDeleted", "true");
  if (filters.search) params.set("search", filters.search);
  const query = params.toString();
  const orders = await fetchAdmin<AdminOrder[]>(
    token,
    `/api/admin/orders/maintenance${query ? `?${query}` : ""}`
  );
  return { token, orders };
}

export async function importHistoricalOrders(
  token: string,
  payload: HistoricalOrderImportInput
): Promise<HistoricalOrderImportResult> {
  return fetchAdmin<HistoricalOrderImportResult>(token, "/api/admin/orders/import", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getAdminDailySummary(): Promise<DailySummary> {
  const token = await getAdminToken();
  return fetchAdmin<DailySummary>(token, "/api/admin/reports/daily-summary");
}

export async function getAdminTenantSummary(): Promise<AdminTenant> {
  const token = await getAdminToken();
  return fetchAdmin<AdminTenant>(token, "/api/admin/tenant");
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

export async function getSalesReport(
  filters: SalesReportFilters = {}
): Promise<SalesReportResponse> {
  const token = await getAdminToken();
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });

  const query = params.toString();
  return fetchAdmin<SalesReportResponse>(
    token,
    `/api/admin/reports/sales${query ? `?${query}` : ""}`
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

export async function listFinancialAccounts(token: string): Promise<FinancialAccount[]> {
  return fetchAdmin<FinancialAccount[]>(token, "/api/admin/financial/accounts");
}

export async function createFinancialAccount(
  token: string,
  payload: FinancialAccountInput
): Promise<FinancialAccount> {
  return fetchAdmin<FinancialAccount>(token, "/api/admin/financial/accounts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateFinancialAccount(
  token: string,
  id: string,
  payload: FinancialAccountInput
): Promise<FinancialAccount> {
  return fetchAdmin<FinancialAccount>(token, `/api/admin/financial/accounts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function listFinancialCategories(token: string): Promise<FinancialCategory[]> {
  return fetchAdmin<FinancialCategory[]>(token, "/api/admin/financial/categories");
}

export async function getCashFlowSetup(): Promise<{
  token: string;
  accounts: FinancialAccount[];
  categories: FinancialCategory[];
}> {
  const token = await getAdminToken();
  const [accounts, categories] = await Promise.all([
    listFinancialAccounts(token),
    listFinancialCategories(token),
  ]);

  return { token, accounts, categories };
}

export async function createFinancialCategory(
  token: string,
  payload: FinancialCategoryInput
): Promise<FinancialCategory> {
  return fetchAdmin<FinancialCategory>(token, "/api/admin/financial/categories", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateFinancialCategory(
  token: string,
  id: string,
  payload: FinancialCategoryInput
): Promise<FinancialCategory> {
  return fetchAdmin<FinancialCategory>(token, `/api/admin/financial/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function getCashPosition(
  filters: {
    asOf?: string;
    projectionEnd?: string;
    financialAccountId?: string;
  } = {}
): Promise<{
  token: string;
  position: CashPosition;
  accounts: FinancialAccount[];
  categories: FinancialCategory[];
}> {
  const token = await getAdminToken();
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  const [position, accounts, categories] = await Promise.all([
    fetchAdmin<CashPosition>(
      token,
      `/api/admin/financial/cash-flow/position${query ? `?${query}` : ""}`
    ),
    listFinancialAccounts(token),
    listFinancialCategories(token),
  ]);

  return { token, position, accounts, categories };
}

export async function getCashLedger(
  token: string,
  filters: { asOf?: string; financialAccountId?: string } = {}
): Promise<CashLedgerEntry[]> {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return fetchAdmin<CashLedgerEntry[]>(
    token,
    `/api/admin/financial/cash-flow/ledger${query ? `?${query}` : ""}`
  );
}

export async function getCashStatement(
  token: string,
  filters: { start?: string; end?: string; financialAccountId?: string } = {}
): Promise<CashStatement> {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return fetchAdmin<CashStatement>(
    token,
    `/api/admin/financial/cash-flow/statement${query ? `?${query}` : ""}`
  );
}

export async function listCashMovements(
  token: string,
  filters: { start?: string; end?: string } = {}
): Promise<CashMovement[]> {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return fetchAdmin<CashMovement[]>(
    token,
    `/api/admin/financial/cash-flow/movements${query ? `?${query}` : ""}`
  );
}

export async function createCashMovement(
  token: string,
  payload: CashMovementInput
): Promise<CashMovement> {
  return fetchAdmin<CashMovement>(token, "/api/admin/financial/cash-flow/movements", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function reverseCashMovement(
  token: string,
  movementId: string,
  payload: { reason: string }
): Promise<CashMovement> {
  return fetchAdmin<CashMovement>(
    token,
    `/api/admin/financial/cash-flow/movements/${movementId}/reverse`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function getPayables(
  filters: {
    start?: string;
    end?: string;
    status?: string;
    categoryId?: string;
    supplierId?: string;
  } = {}
): Promise<{ token: string; payables: PayablesResponse; options: PayableOptions }> {
  const token = await getAdminToken();
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  const [payables, options] = await Promise.all([
    fetchAdmin<PayablesResponse>(token, `/api/admin/financial/payables${query ? `?${query}` : ""}`),
    fetchAdmin<PayableOptions>(token, "/api/admin/financial/payables/options"),
  ]);

  return { token, payables, options };
}

export async function createPayable(
  token: string,
  payload: PayableInput
): Promise<PayablesResponse> {
  return fetchAdmin<PayablesResponse>(token, "/api/admin/financial/payables", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updatePayable(
  token: string,
  id: string,
  payload: PayableInput
): Promise<Payable> {
  return fetchAdmin<Payable>(token, `/api/admin/financial/payables/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function cancelPayable(
  token: string,
  id: string,
  payload: { reason: string }
): Promise<Payable> {
  return fetchAdmin<Payable>(token, `/api/admin/financial/payables/${id}/cancel`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function addPayablePayment(
  token: string,
  id: string,
  payload: PayablePaymentInput
): Promise<Payable> {
  return fetchAdmin<Payable>(token, `/api/admin/financial/payables/${id}/payments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function reversePayablePayment(
  token: string,
  paymentId: string,
  payload: { reason: string }
): Promise<Payable> {
  return fetchAdmin<Payable>(token, `/api/admin/financial/payables/payments/${paymentId}/reverse`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getPayableAuditHistory(
  token: string,
  payableId: string
): Promise<FinancialAuditRecord[]> {
  return fetchAdmin<FinancialAuditRecord[]>(
    token,
    `/api/admin/financial/payables/${payableId}/audit`
  );
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

export async function getDeliveryIntegrations(): Promise<{
  token: string;
  integrations: DeliveryIntegrationDetail[];
  orderPlatforms: OrderPlatform[];
}> {
  const token = await getAdminToken();
  const [integrations, orderPlatforms] = await Promise.all([
    fetchAdmin<DeliveryIntegrationDetail[]>(token, "/api/admin/integrations/delivery"),
    fetchAdmin<OrderPlatform[]>(token, "/api/admin/order-platforms"),
  ]);

  return { token, integrations, orderPlatforms };
}

export async function createDeliveryIntegration(
  token: string,
  payload: DeliveryIntegrationPayload
): Promise<DeliveryIntegrationDetail> {
  return fetchAdmin<DeliveryIntegrationDetail>(token, "/api/admin/integrations/delivery", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateDeliveryIntegration(
  token: string,
  id: string,
  payload: Partial<DeliveryIntegrationPayload>
): Promise<DeliveryIntegrationDetail> {
  return fetchAdmin<DeliveryIntegrationDetail>(token, `/api/admin/integrations/delivery/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function saveDeliveryIntegrationCredentials(
  token: string,
  id: string,
  payload: DeliveryCredentialPayload
): Promise<void> {
  await fetchAdmin<unknown>(token, `/api/admin/integrations/delivery/${id}/credentials`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function validateDeliveryIntegration(
  token: string,
  id: string
): Promise<{ valid: boolean; status: DeliveryIntegrationStatus; checks: unknown[] }> {
  return fetchAdmin(token, `/api/admin/integrations/delivery/${id}/validate`, {
    method: "POST",
  });
}

export async function activateDeliveryIntegration(
  token: string,
  id: string
): Promise<DeliveryIntegrationDetail> {
  return fetchAdmin<DeliveryIntegrationDetail>(
    token,
    `/api/admin/integrations/delivery/${id}/activate`,
    {
      method: "POST",
    }
  );
}

export async function pauseDeliveryIntegration(
  token: string,
  id: string
): Promise<DeliveryIntegrationDetail> {
  return fetchAdmin<DeliveryIntegrationDetail>(
    token,
    `/api/admin/integrations/delivery/${id}/pause`,
    {
      method: "POST",
    }
  );
}

export async function getDeliveryIntegrationHealth(
  token: string,
  id: string
): Promise<DeliveryIntegrationHealth> {
  return fetchAdmin<DeliveryIntegrationHealth>(
    token,
    `/api/admin/integrations/delivery/${id}/health`
  );
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
