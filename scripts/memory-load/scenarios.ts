export interface MemoryScenarioStep {
  name: string;
  method: "GET" | "POST";
  path: string;
  critical: boolean;
}

export const representativeCycle: MemoryScenarioStep[] = [
  { name: "health", method: "GET", path: "/api/health", critical: true },
  { name: "notification-summary", method: "GET", path: "/api/admin/notifications/summary", critical: false },
  { name: "kds-snapshot", method: "GET", path: "/api/admin/orders/kds", critical: true },
  { name: "public-queue", method: "GET", path: "/api/public/tenants/demo/order-queue", critical: true },
  { name: "sales-report-31-days", method: "GET", path: "/api/admin/reports/sales", critical: false },
  { name: "management-report-31-days", method: "GET", path: "/api/admin/reports/management", critical: false },
];

export const cycleCount = 5;
export const stabilizationMinutes = 15;
export const soakHours = 8;
