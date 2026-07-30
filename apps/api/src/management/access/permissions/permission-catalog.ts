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
  {
    key: "pos.capture",
    area: "Operacao",
    screen: "Capturar pedido",
    action: "CREATE",
    description: "Criar pedidos presenciais no balcao",
    sensitive: false,
  },
  {
    key: "pos.override-price",
    area: "Operacao",
    screen: "Capturar pedido",
    action: "APPROVE",
    description: "Alterar o preco calculado de itens mediante justificativa",
    sensitive: true,
  },
  {
    key: "tabs.view",
    area: "Operacao",
    screen: "Comandas",
    action: "VIEW",
    description: "Visualizar comandas e seus saldos",
    sensitive: false,
  },
  {
    key: "tabs.manage",
    area: "Operacao",
    screen: "Comandas",
    action: "MANAGE",
    description: "Abrir, fechar, reabrir e transferir comandas",
    sensitive: false,
  },
  {
    key: "kds.view",
    area: "Operacao",
    screen: "KDS",
    action: "VIEW",
    description: "Visualizar a fila de producao",
    sensitive: false,
  },
  {
    key: "kds.manage",
    area: "Operacao",
    screen: "KDS",
    action: "MANAGE",
    description: "Atualizar o andamento de producao dos pedidos",
    sensitive: false,
  },
  {
    key: "payments.charge",
    area: "Pagamentos",
    screen: "Cobranca",
    action: "CREATE",
    description: "Iniciar cobrancas em instituicoes habilitadas",
    sensitive: true,
  },
  {
    key: "payments.confirm-manual",
    area: "Pagamentos",
    screen: "Cobranca",
    action: "APPROVE",
    description: "Confirmar pagamentos manuais",
    sensitive: true,
  },
  {
    key: "payments.cancel",
    area: "Pagamentos",
    screen: "Cobranca",
    action: "DELETE",
    description: "Cancelar tentativas ou confirmacoes elegiveis",
    sensitive: true,
  },
  {
    key: "payments.refund",
    area: "Pagamentos",
    screen: "Cobranca",
    action: "APPROVE",
    description: "Solicitar estorno de pagamentos",
    sensitive: true,
  },
  {
    key: "payments.reconcile",
    area: "Pagamentos",
    screen: "Excecoes",
    action: "MANAGE",
    description: "Reconciliar resultados inconclusivos ou divergentes",
    sensitive: true,
  },
  {
    key: "payment-terminals.manage",
    area: "Pagamentos",
    screen: "Maquininhas",
    action: "MANAGE",
    description: "Sincronizar e habilitar maquininhas da loja",
    sensitive: true,
  },
  {
    key: "payment-exceptions.view",
    area: "Pagamentos",
    screen: "Excecoes",
    action: "VIEW",
    description: "Visualizar excecoes e divergencias de pagamento",
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
