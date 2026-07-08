import { describe, expect, it } from "vitest";
import {
  adminNavigation,
  canAccessNavigationItem,
  filterNavigationBySession,
  findNavigationItem,
  secondaryNavigation,
} from "./admin-navigation";

const operatorSession = {
  user: { isMaster: false },
  permissions: ["orders.view"],
};

const financeSession = {
  user: { isMaster: false },
  permissions: ["finance.view"],
};

const masterSession = {
  user: { isMaster: true },
  permissions: [],
};

const platformSession = {
  user: { isPlatformAdmin: true, platformRole: "SUPER_ADMIN" },
  permissions: [],
};

describe("admin navigation permissions", () => {
  it("filters menu entries by the logged user permissions", () => {
    const groups = filterNavigationBySession(adminNavigation, operatorSession);
    const labels = groups.flatMap((group) => group.items.map((item) => item.label));

    expect(labels).toContain("Pedidos");
    expect(labels).toContain("Estoque");
    expect(labels).not.toContain("Contas a pagar");
    expect(labels).not.toContain("Usuarios");
    expect(labels).not.toContain("Perfis");
  });

  it("allows financial views only to financial profiles", () => {
    const groups = filterNavigationBySession(adminNavigation, financeSession);
    const labels = groups.flatMap((group) => group.items.map((item) => item.label));

    expect(labels).toContain("Contas a pagar");
    expect(labels).toContain("Caixa");
    expect(labels).toContain("DRE");
    expect(labels).not.toContain("Usuarios");
  });

  it("keeps platform links restricted to platform admins", () => {
    const stores = secondaryNavigation.find((item) => item.href === "/platform/stores");
    const users = secondaryNavigation.find((item) => item.href === "/platform/users");
    const publicMenu = secondaryNavigation.find((item) => item.href === "/piloto");
    const managementReport = adminNavigation
      .flatMap((group) => group.items)
      .find((item) => item.href === "/admin/reports/management");

    expect(stores).toBeDefined();
    expect(users).toBeDefined();
    expect(publicMenu).toBeDefined();
    expect(managementReport).toBeDefined();
    expect(canAccessNavigationItem(stores!, operatorSession)).toBe(false);
    expect(canAccessNavigationItem(stores!, masterSession)).toBe(false);
    expect(canAccessNavigationItem(stores!, platformSession)).toBe(true);
    expect(canAccessNavigationItem(users!, platformSession)).toBe(true);
    expect(canAccessNavigationItem(publicMenu!, platformSession)).toBe(true);
    expect(canAccessNavigationItem(managementReport!, platformSession)).toBe(false);
  });

  it("resolves direct route access using the same permission metadata", () => {
    const users = findNavigationItem("/admin/users");
    const orders = findNavigationItem("/admin/orders/123");

    expect(users).toBeDefined();
    expect(orders).toBeDefined();
    expect(canAccessNavigationItem(users!, operatorSession)).toBe(false);
    expect(canAccessNavigationItem(orders!, operatorSession)).toBe(true);
  });
});
