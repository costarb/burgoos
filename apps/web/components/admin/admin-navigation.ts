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
  Gauge,
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
      },
      {
        href: "/admin/orders/import",
        label: "Importar pedidos",
        icon: Import,
        description: "Extratos e vendas historicas",
      },
      { href: "/admin/inventory", label: "Estoque", icon: Boxes, description: "Saldos estimados" },
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
      },
      {
        href: "/admin/ingredients",
        label: "Insumos",
        icon: CookingPot,
        description: "Custos de ingredientes",
      },
      {
        href: "/admin/technical-sheets",
        label: "Fichas tecnicas",
        icon: BookOpenText,
        description: "Composicao dos produtos",
      },
      {
        href: "/admin/pricing",
        label: "Precificacao",
        icon: Calculator,
        description: "Margens e precos",
      },
      {
        href: "/admin/menu-engineering",
        label: "Menu engineering",
        icon: Utensils,
        description: "Popularidade e margem",
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
      },
      {
        href: "/admin/finance/cash-flow",
        label: "Caixa",
        icon: WalletCards,
        description: "Saldo e projecao",
      },
      {
        href: "/admin/reports/dre",
        label: "DRE",
        icon: FileChartColumn,
        description: "Resultado financeiro",
      },
      {
        href: "/admin/reports/sales",
        label: "Vendas",
        icon: BarChart3,
        description: "Evolucao e analise",
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
      },
      {
        href: "/admin/purchase-units",
        label: "Unidades",
        icon: PackageSearch,
        description: "Medidas de compra",
      },
      {
        href: "/admin/order-platforms",
        label: "Plataformas",
        icon: Store,
        description: "Canais e taxas",
      },
      {
        href: "/admin/branding",
        label: "Identidade visual",
        icon: Palette,
        description: "Marca e tema",
      },
      {
        href: "/admin/settings",
        label: "Configuracoes",
        icon: Settings,
        description: "Parametros financeiros",
      },
    ],
  },
  {
    label: "Acessos",
    items: [
      { href: "/admin/users", label: "Usuarios", icon: Users, description: "Usuarios e lojas" },
      {
        href: "/admin/access-profiles",
        label: "Perfis",
        icon: ShieldCheck,
        description: "Permissoes por perfil",
      },
      {
        href: "/admin/access-audit",
        label: "Auditoria",
        icon: ScrollText,
        description: "Historico de acessos",
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
