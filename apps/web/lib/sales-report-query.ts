import type { SalesReportFilters } from "@burgoos/types";

const arrayQueryKeys = {
  paymentInstitutions: "paymentInstitution",
  paymentMethods: "paymentMethod",
  orderPlatformIds: "orderPlatformId",
  statuses: "status",
} as const satisfies Partial<Record<keyof SalesReportFilters, string>>;

export function buildSalesReportSearchParams(filters: SalesReportFilters): URLSearchParams {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      const queryKey = arrayQueryKeys[key as keyof typeof arrayQueryKeys];

      if (queryKey) {
        [...new Set(value)].forEach((item) => params.append(queryKey, String(item)));
      }

      return;
    }

    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });

  return params;
}
