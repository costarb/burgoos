import type {
  AdminOrder,
  CreatedOrder,
  CreatePublicOrderInput,
  OrderStatus,
  PublicMenu
} from "@burgoos/types";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface AdminCategory {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
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

export async function getPublicMenu(slug: string): Promise<PublicMenu | null> {
  const response = await fetch(`${apiUrl}/api/public/tenants/${slug}/menu`, {
    next: {
      revalidate: 30
    }
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
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    cache: "no-store"
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
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store"
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
  categories: AdminCategory[];
  products: AdminProduct[];
}> {
  const token = await getAdminToken();

  const headers = {
    Authorization: `Bearer ${token}`
  };

  const [categoriesResponse, productsResponse] = await Promise.all([
    fetch(`${apiUrl}/api/admin/categories`, { headers, cache: "no-store" }),
    fetch(`${apiUrl}/api/admin/products`, { headers, cache: "no-store" })
  ]);

  if (!categoriesResponse.ok || !productsResponse.ok) {
    throw new Error("Failed to load admin catalog");
  }

  return {
    categories: (await categoriesResponse.json()) as AdminCategory[],
    products: (await productsResponse.json()) as AdminProduct[]
  };
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
    Authorization: `Bearer ${token}`
  };

  const [tenantResponse, activeResponse, historyResponse] = await Promise.all([
    fetch(`${apiUrl}/api/admin/tenant`, { headers, cache: "no-store" }),
    fetch(`${apiUrl}/api/admin/orders`, { headers, cache: "no-store" }),
    fetch(`${apiUrl}/api/admin/orders?history=true`, { headers, cache: "no-store" })
  ]);

  if (!tenantResponse.ok || !activeResponse.ok || !historyResponse.ok) {
    throw new Error("Failed to load admin orders");
  }

  return {
    token,
    apiUrl,
    tenant: (await tenantResponse.json()) as AdminTenant,
    activeOrders: (await activeResponse.json()) as AdminOrder[],
    historyOrders: (await historyResponse.json()) as AdminOrder[]
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
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ status }),
    cache: "no-store"
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
      Authorization: `Bearer ${token}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Failed to load daily summary");
  }

  return response.json() as Promise<DailySummary>;
}
