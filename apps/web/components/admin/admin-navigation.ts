import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpenText,
  Boxes,
  Building2,
  Calculator,
  ClipboardList,
  CookingPot,
  FileChartColumn,
  Import,
  LayoutDashboard,
  PackageSearch,
  Palette,
  ReceiptText,
  ScrollText,
  WalletCards,
  ShieldCheck,
  Settings,
  ShoppingBag,
  Store,
  Tags,
  Truck,
  Users,
  Utensils,
} from "lucide-react";

export interface AdminNavigationItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  permissions?: string[];
  masterOnly?: boolean;
  platformAdminOnly?: boolean;
}

export interface AdminNavigationGroup {
  label: string;
  items: AdminNavigationItem[];
}

export const adminNavigation: AdminNavigationGroup[] = [
  {
    label: "Visao geral",
    items: [
      {
        href: "/admin",
        label: "Painel",
        icon: LayoutDashboard,
        description: "Indicadores operacionais",
        permissions: ["orders.view", "finance.view", "catalog.manage", "access.users.manage"],
      },
    ],
  },
  {
    label: "Operacao",
    items: [
      {
        href: "/admin/orders",
        label: "Pedidos",
        icon: ClipboardList,
        description: "Fila e historico",
        permissions: ["orders.view", "orders.manage"],
      },
      {
        href: "/admin/orders/import",
        label: "Importar pedidos",
        icon: Import,
        description: "Extratos e vendas historicas",
        permissions: ["orders.manage"],
      },
      {
        href: "/admin/inventory",
        label: "Estoque",
        icon: Boxes,
        description: "Saldos estimados",
        permissions: ["orders.view", "catalog.manage"],
      },
    ],
  },
  {
    label: "Cardapio e custos",
    items: [
      {
        href: "/admin/catalog",
        label: "Catalogo",
        icon: ShoppingBag,
        description: "Categorias e produtos",
        permissions: ["catalog.manage"],
      },
      {
        href: "/admin/ingredients",
        label: "Insumos",
        icon: CookingPot,
        description: "Custos de ingredientes",
        permissions: ["catalog.manage"],
      },
      {
        href: "/admin/technical-sheets",
        label: "Fichas tecnicas",
        icon: BookOpenText,
        description: "Composicao dos produtos",
        permissions: ["catalog.manage"],
      },
      {
        href: "/admin/pricing",
        label: "Precificacao",
        icon: Calculator,
        description: "Margens e precos",
        permissions: ["catalog.manage", "finance.view"],
      },
      {
        href: "/admin/menu-engineering",
        label: "Menu engineering",
        icon: Utensils,
        description: "Popularidade e margem",
        permissions: ["finance.view"],
      },
    ],
  },
  {
    label: "Financeiro",
    items: [
      {
        href: "/admin/finance/payables",
        label: "Contas a pagar",
        icon: ReceiptText,
        description: "Obrigacoes e pagamentos",
        permissions: ["finance.view", "finance.manage"],
      },
      {
        href: "/admin/finance/cash-flow",
        label: "Caixa",
        icon: WalletCards,
        description: "Saldo e projecao",
        permissions: ["finance.view", "finance.manage"],
      },
      {
        href: "/admin/finance/institutions",
        label: "Instituicoes",
        icon: WalletCards,
        description: "Instituicoes financeiras",
        permissions: ["finance.view", "finance.manage"],
      },
      {
        href: "/admin/reports/dre",
        label: "DRE",
        icon: FileChartColumn,
        description: "Resultado financeiro",
        permissions: ["finance.view"],
      },
      {
        href: "/admin/reports/sales",
        label: "Vendas",
        icon: BarChart3,
        description: "Evolucao e analise",
        permissions: ["finance.view"],
      },
      {
        href: "/admin/reports/management",
        label: "Gerencial",
        icon: FileChartColumn,
        description: "Caixa, vendas e contas a pagar",
        permissions: ["finance.view"],
      },
    ],
  },
  {
    label: "Cadastros",
    items: [
      {
        href: "/admin/suppliers",
        label: "Fornecedores",
        icon: Truck,
        description: "Parceiros de compra",
        permissions: ["catalog.manage", "finance.manage"],
      },
      {
        href: "/admin/purchase-units",
        label: "Unidades",
        icon: PackageSearch,
        description: "Medidas de compra",
        permissions: ["catalog.manage"],
      },
      {
        href: "/admin/order-platforms",
        label: "Plataformas",
        icon: Store,
        description: "Canais e taxas",
        permissions: ["finance.manage"],
      },
      {
        href: "/admin/integrations/delivery",
        label: "Delivery",
        icon: Truck,
        description: "Integracoes de pedidos",
        permissions: ["integrations.delivery.view", "integrations.delivery.manage"],
      },
      {
        href: "/admin/branding",
        label: "Identidade visual",
        icon: Palette,
        description: "Marca e tema",
        permissions: ["catalog.manage"],
      },
      {
        href: "/admin/settings",
        label: "Configuracoes",
        icon: Settings,
        description: "Parametros financeiros",
        permissions: ["finance.manage"],
      },
    ],
  },
  {
    label: "Acessos",
    items: [
      {
        href: "/admin/users",
        label: "Usuarios",
        icon: Users,
        description: "Usuarios e lojas",
        permissions: ["access.users.manage"],
      },
      {
        href: "/admin/access-profiles",
        label: "Perfis",
        icon: ShieldCheck,
        description: "Permissoes por perfil",
        permissions: ["access.profiles.manage"],
      },
      {
        href: "/admin/access-audit",
        label: "Auditoria",
        icon: ScrollText,
        description: "Historico de acessos",
        permissions: ["access.audit.view"],
      },
    ],
  },
];

export const secondaryNavigation: AdminNavigationItem[] = [
  {
    href: "/platform/stores",
    label: "Lojas",
    icon: Building2,
    description: "Gestao da plataforma",
    platformAdminOnly: true,
  },
  {
    href: "/platform/users",
    label: "Admins plataforma",
    icon: Users,
    description: "Usuarios da plataforma",
    platformAdminOnly: true,
  },
  {
    href: "/platform/integrations",
    label: "Integrações",
    icon: Settings,
    description: "Credenciais dos provedores",
    platformAdminOnly: true,
  },
  {
    href: "/piloto",
    label: "Cardapio publico",
    icon: Tags,
    description: "Abrir experiencia publica",
  },
];

export function findNavigationItem(pathname: string): AdminNavigationItem | undefined {
  const items = [...adminNavigation.flatMap((group) => group.items), ...secondaryNavigation];

  return items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

export function canAccessNavigationItem(
  item: AdminNavigationItem,
  session: {
    user: { isMaster?: boolean; isPlatformAdmin?: boolean; platformRole?: string };
    permissions?: string[];
  } | null
): boolean {
  if (!session) {
    return false;
  }

  if (item.platformAdminOnly) {
    return Boolean(session.user.isPlatformAdmin && session.user.platformRole === "SUPER_ADMIN");
  }

  if (session.user.isPlatformAdmin) {
    return !item.permissions?.length && !item.masterOnly;
  }

  if (session.user.isMaster) {
    return true;
  }

  if (item.masterOnly) {
    return false;
  }

  if (!item.permissions?.length) {
    return true;
  }

  return item.permissions.some((permission) => session.permissions?.includes(permission));
}

export function filterNavigationBySession(
  groups: AdminNavigationGroup[],
  session: {
    user: { isMaster?: boolean; isPlatformAdmin?: boolean; platformRole?: string };
    permissions?: string[];
  } | null
): AdminNavigationGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessNavigationItem(item, session)),
    }))
    .filter((group) => group.items.length > 0);
}
