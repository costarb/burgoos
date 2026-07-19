type AccessPermissionAction = "VIEW" | "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "MANAGE";

interface AccessPermission {
  key: string;
  area: string;
  screen: string;
  action: AccessPermissionAction;
  description: string;
  sensitive: boolean;
}

interface AccessPermissionGroup {
  area: string;
  screens: Array<{
    screen: string;
    permissions: AccessPermission[];
  }>;
}

export const ACCESS_PERMISSIONS = [
  {
    key: "orders.view",
    area: "Operacao",
    screen: "Pedidos",
    action: "VIEW",
    description: "Visualizar pedidos e historico operacional",
    sensitive: false,
  },
  {
    key: "orders.manage",
    area: "Operacao",
    screen: "Pedidos",
    action: "MANAGE",
    description: "Atualizar status e realizar manutencao de pedidos",
    sensitive: true,
  },
  {
    key: "catalog.manage",
    area: "Cardapio",
    screen: "Catalogo",
    action: "MANAGE",
    description: "Criar e alterar categorias e produtos",
    sensitive: false,
  },
  {
    key: "finance.view",
    area: "Financeiro",
    screen: "Caixa e contas",
    action: "VIEW",
    description: "Visualizar contas, saldo e relatorios financeiros",
    sensitive: true,
  },
  {
    key: "finance.manage",
    area: "Financeiro",
    screen: "Caixa e contas",
    action: "MANAGE",
    description: "Gerenciar contas, pagamentos e movimentos financeiros",
    sensitive: true,
  },
  {
    key: "access.users.manage",
    area: "Acessos",
    screen: "Usuarios",
    action: "MANAGE",
    description: "Criar, alterar, ativar e desativar usuarios",
    sensitive: true,
  },
  {
    key: "access.profiles.manage",
    area: "Acessos",
    screen: "Perfis",
    action: "MANAGE",
    description: "Criar e alterar perfis e permissoes",
    sensitive: true,
  },
  {
    key: "access.audit.view",
    area: "Acessos",
    screen: "Auditoria",
    action: "VIEW",
    description: "Consultar historico de autenticacao e mudancas de acesso",
    sensitive: true,
  },
  {
    key: "integrations.sales.view",
    area: "Integracoes",
    screen: "Vendas externas",
    action: "VIEW",
    description: "Visualizar integracoes e importacoes de vendas externas",
    sensitive: true,
  },
  {
    key: "integrations.sales.manage",
    area: "Integracoes",
    screen: "Vendas externas",
    action: "MANAGE",
    description: "Configurar providers e importar vendas externas",
    sensitive: true,
  },
] satisfies AccessPermission[];

export function groupAccessPermissions(
  permissions: AccessPermission[] = ACCESS_PERMISSIONS
): AccessPermissionGroup[] {
  const areas = new Map<string, Map<string, AccessPermission[]>>();

  for (const permission of permissions) {
    const screens = areas.get(permission.area) ?? new Map<string, AccessPermission[]>();
    const screenPermissions = screens.get(permission.screen) ?? [];

    screenPermissions.push(permission);
    screens.set(permission.screen, screenPermissions);
    areas.set(permission.area, screens);
  }

  return [...areas.entries()].map(([area, screens]) => ({
    area,
    screens: [...screens.entries()].map(([screen, screenPermissions]) => ({
      screen,
      permissions: screenPermissions,
    })),
  }));
}
