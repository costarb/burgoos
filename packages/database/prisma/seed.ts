import {
  AccessPermissionAction,
  AccessProfileScope,
  AccessProfileStatus,
  AccessUserStatus,
  LayoutPresetSurface,
  PaymentInstitution,
  PlatformUserRole,
  PrismaClient,
  PurchaseUnitKind,
  UserRole,
} from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const passwordHash = await hash("admin123", 10);

  await prisma.platformUser.upsert({
    where: { email: "platform@burgoos.local" },
    update: {
      active: true,
      role: PlatformUserRole.SUPER_ADMIN,
    },
    create: {
      role: PlatformUserRole.SUPER_ADMIN,
      name: "Admin Plataforma",
      email: "platform@burgoos.local",
      passwordHash,
      active: true,
    },
  });

  const layoutPresets = [
    {
      key: "classic",
      name: "Classico",
      description: "Menu familiar com categorias em destaque.",
      targetSurface: LayoutPresetSurface.PUBLIC_MENU,
    },
    {
      key: "compact",
      name: "Compacto",
      description: "Menu denso para cardapios com muitas categorias e produtos.",
      targetSurface: LayoutPresetSurface.PUBLIC_MENU,
    },
    {
      key: "visual",
      name: "Visual",
      description: "Menu com mais destaque para fotos e identidade da marca.",
      targetSurface: LayoutPresetSurface.PUBLIC_MENU,
    },
  ];

  for (const preset of layoutPresets) {
    await prisma.layoutPreset.upsert({
      where: { key: preset.key },
      update: {
        name: preset.name,
        description: preset.description,
        targetSurface: preset.targetSurface,
        active: true,
      },
      create: {
        ...preset,
        active: true,
      },
    });
  }

  const tenant = await prisma.tenant.upsert({
    where: { slug: "piloto" },
    update: {
      defaultLayoutPresetKey: "classic",
    },
    create: {
      name: "Loja Piloto",
      slug: "piloto",
      phone: "5500000000000",
      active: true,
      isOpen: true,
      setupCompletedAt: new Date(),
      defaultLayoutPresetKey: "classic",
      config: {
        pixInstructions: "Chave PIX da loja piloto",
        openingHours: "18:00-23:00",
      },
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@burgoos.local" },
    update: {
      isMaster: true,
      status: AccessUserStatus.ACTIVE,
      role: UserRole.OWNER,
    },
    create: {
      tenantId: tenant.id,
      role: UserRole.OWNER,
      status: AccessUserStatus.ACTIVE,
      isMaster: true,
      name: "Admin Piloto",
      email: "admin@burgoos.local",
      passwordHash,
    },
  });

  const secondTenant = await prisma.tenant.upsert({
    where: { slug: "filial-teste" },
    update: {
      defaultLayoutPresetKey: "classic",
    },
    create: {
      name: "Filial Teste",
      slug: "filial-teste",
      phone: "5500000000001",
      active: true,
      isOpen: false,
      setupCompletedAt: new Date(),
      defaultLayoutPresetKey: "classic",
      config: {
        pixInstructions: "Chave PIX da filial teste",
        openingHours: "18:00-23:00",
      },
    },
  });

  const accessPermissions = [
    {
      key: "orders.view",
      area: "Operacao",
      screen: "Pedidos",
      action: AccessPermissionAction.VIEW,
      description: "Visualizar pedidos e historico operacional",
      sensitive: false,
    },
    {
      key: "orders.manage",
      area: "Operacao",
      screen: "Pedidos",
      action: AccessPermissionAction.MANAGE,
      description: "Atualizar status e realizar manutencao de pedidos",
      sensitive: true,
    },
    {
      key: "catalog.manage",
      area: "Cardapio",
      screen: "Catalogo",
      action: AccessPermissionAction.MANAGE,
      description: "Criar e alterar categorias e produtos",
      sensitive: false,
    },
    {
      key: "finance.view",
      area: "Financeiro",
      screen: "Caixa e contas",
      action: AccessPermissionAction.VIEW,
      description: "Visualizar contas, saldo e relatorios financeiros",
      sensitive: true,
    },
    {
      key: "finance.manage",
      area: "Financeiro",
      screen: "Caixa e contas",
      action: AccessPermissionAction.MANAGE,
      description: "Gerenciar contas, pagamentos e movimentos financeiros",
      sensitive: true,
    },
    {
      key: "access.users.manage",
      area: "Acessos",
      screen: "Usuarios",
      action: AccessPermissionAction.MANAGE,
      description: "Criar, alterar, ativar e desativar usuarios",
      sensitive: true,
    },
    {
      key: "access.profiles.manage",
      area: "Acessos",
      screen: "Perfis",
      action: AccessPermissionAction.MANAGE,
      description: "Criar e alterar perfis e permissoes",
      sensitive: true,
    },
    {
      key: "access.audit.view",
      area: "Acessos",
      screen: "Auditoria",
      action: AccessPermissionAction.VIEW,
      description: "Consultar historico de autenticacao e mudancas de acesso",
      sensitive: true,
    },
    {
      key: "integrations.delivery.view",
      area: "Integracoes",
      screen: "Delivery",
      action: AccessPermissionAction.VIEW,
      description: "Visualizar configuracoes e saude das integracoes de delivery",
      sensitive: true,
    },
    {
      key: "integrations.delivery.manage",
      area: "Integracoes",
      screen: "Delivery",
      action: AccessPermissionAction.MANAGE,
      description: "Configurar, validar, ativar e pausar integracoes de delivery",
      sensitive: true,
    },
  ];

  for (const permission of accessPermissions) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: permission,
      create: permission,
    });
  }

  async function ensureProfile(input: {
    tenantId: string | null;
    name: string;
    description: string;
    scope: AccessProfileScope;
    permissionKeys: string[];
  }) {
    const existing = await prisma.accessProfile.findFirst({
      where: {
        tenantId: input.tenantId,
        name: input.name,
      },
      select: { id: true },
    });

    const profile =
      existing ??
      (await prisma.accessProfile.create({
        data: {
          tenantId: input.tenantId,
          name: input.name,
          description: input.description,
          scope: input.scope,
          status: AccessProfileStatus.ACTIVE,
        },
        select: { id: true },
      }));

    for (const key of input.permissionKeys) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { key },
        select: { id: true },
      });

      await prisma.accessProfilePermission.upsert({
        where: {
          profileId_permissionId: {
            profileId: profile.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          profileId: profile.id,
          permissionId: permission.id,
        },
      });
    }

    return profile;
  }

  const masterProfile = await ensureProfile({
    tenantId: null,
    name: "Master",
    description: "Controle completo da plataforma administrativa.",
    scope: AccessProfileScope.GLOBAL,
    permissionKeys: accessPermissions.map((permission) => permission.key),
  });

  const storeAdminProfile = await ensureProfile({
    tenantId: tenant.id,
    name: "Admin da loja",
    description: "Gerencia operacao e acessos da loja piloto.",
    scope: AccessProfileScope.STORE,
    permissionKeys: [
      "orders.view",
      "orders.manage",
      "catalog.manage",
      "finance.view",
      "access.users.manage",
      "access.audit.view",
      "integrations.delivery.view",
      "integrations.delivery.manage",
    ],
  });

  const operatorProfile = await ensureProfile({
    tenantId: tenant.id,
    name: "Operador",
    description: "Acompanha e atualiza a operacao diaria.",
    scope: AccessProfileScope.STORE,
    permissionKeys: ["orders.view", "orders.manage"],
  });

  const masterUser = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@burgoos.local" },
    select: { id: true },
  });

  await prisma.userStoreAssignment.upsert({
    where: {
      userId_tenantId: {
        userId: masterUser.id,
        tenantId: tenant.id,
      },
    },
    update: {
      profileId: masterProfile.id,
      canManageStoreAccess: true,
      status: AccessProfileStatus.ACTIVE,
    },
    create: {
      userId: masterUser.id,
      tenantId: tenant.id,
      profileId: masterProfile.id,
      canManageStoreAccess: true,
      status: AccessProfileStatus.ACTIVE,
    },
  });

  await prisma.userStoreAssignment.upsert({
    where: {
      userId_tenantId: {
        userId: masterUser.id,
        tenantId: secondTenant.id,
      },
    },
    update: {
      profileId: masterProfile.id,
      canManageStoreAccess: true,
      status: AccessProfileStatus.ACTIVE,
    },
    create: {
      userId: masterUser.id,
      tenantId: secondTenant.id,
      profileId: masterProfile.id,
      canManageStoreAccess: true,
      status: AccessProfileStatus.ACTIVE,
    },
  });

  const storeAdmin = await prisma.user.upsert({
    where: { email: "loja.admin@burgoos.local" },
    update: {
      status: AccessUserStatus.ACTIVE,
      isMaster: false,
    },
    create: {
      tenantId: tenant.id,
      role: UserRole.ADMIN,
      status: AccessUserStatus.ACTIVE,
      isMaster: false,
      name: "Admin Loja Piloto",
      email: "loja.admin@burgoos.local",
      passwordHash,
    },
  });

  await prisma.userStoreAssignment.upsert({
    where: {
      userId_tenantId: {
        userId: storeAdmin.id,
        tenantId: tenant.id,
      },
    },
    update: {
      profileId: storeAdminProfile.id,
      canManageStoreAccess: true,
      status: AccessProfileStatus.ACTIVE,
    },
    create: {
      userId: storeAdmin.id,
      tenantId: tenant.id,
      profileId: storeAdminProfile.id,
      canManageStoreAccess: true,
      status: AccessProfileStatus.ACTIVE,
    },
  });

  const operatorUser = await prisma.user.upsert({
    where: { email: "operador@burgoos.local" },
    update: {
      status: AccessUserStatus.ACTIVE,
      isMaster: false,
    },
    create: {
      tenantId: tenant.id,
      role: UserRole.OPERATOR,
      status: AccessUserStatus.ACTIVE,
      isMaster: false,
      name: "Operador Piloto",
      email: "operador@burgoos.local",
      passwordHash,
      storeAssignments: {
        create: {
          tenantId: tenant.id,
          profileId: operatorProfile.id,
          canManageStoreAccess: false,
          status: AccessProfileStatus.ACTIVE,
        },
      },
    },
  });

  await prisma.userStoreAssignment.upsert({
    where: {
      userId_tenantId: {
        userId: operatorUser.id,
        tenantId: tenant.id,
      },
    },
    update: {
      profileId: operatorProfile.id,
      canManageStoreAccess: false,
      status: AccessProfileStatus.ACTIVE,
    },
    create: {
      userId: operatorUser.id,
      tenantId: tenant.id,
      profileId: operatorProfile.id,
      canManageStoreAccess: false,
      status: AccessProfileStatus.ACTIVE,
    },
  });

  await prisma.financialConfiguration.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      taxRate: 0.06,
      cardFeeRate: 0.035,
      operationalLossRate: 0.03,
      desiredMarginRate: 0.3,
      averagePackagingCost: 2.5,
      monthlyFixedCost: 8000,
      monthlyRevenueGoal: 35000,
      cmvWarningRate: 0.35,
      netMarginGoalRate: 0.15,
    },
  });

  const financialAccounts = [
    { name: "PagBank", paymentInstitution: PaymentInstitution.PAGBANK },
    { name: "Mercado Pago", paymentInstitution: PaymentInstitution.MERCADO_PAGO },
    { name: "Dinheiro", paymentInstitution: PaymentInstitution.DINHEIRO },
    { name: "Caixa Local", paymentInstitution: PaymentInstitution.CAIXA_LOCAL },
  ];

  for (const account of financialAccounts) {
    const existingAccount = await prisma.financialAccount.findFirst({
      where: {
        tenantId: tenant.id,
        OR: [{ name: account.name }, { paymentInstitution: account.paymentInstitution }],
      },
      select: { id: true },
    });

    if (!existingAccount) {
      await prisma.financialAccount.create({
        data: {
          tenantId: tenant.id,
          name: account.name,
          paymentInstitution: account.paymentInstitution,
          openingBalance: 0,
          openingBalanceAt: new Date(),
          active: true,
        },
      });
    }
  }

  const financialCategories = [
    "Insumos",
    "Aluguel",
    "Energia",
    "Taxas",
    "Equipamentos",
    "Prestador de Serviço",
    "Outros",
  ];

  for (const name of financialCategories) {
    const existingCategory = await prisma.financialCategory.findUnique({
      where: {
        tenantId_name: {
          tenantId: tenant.id,
          name,
        },
      },
      select: { id: true },
    });

    if (!existingCategory) {
      await prisma.financialCategory.create({
        data: {
          tenantId: tenant.id,
          name,
          active: true,
        },
      });
    }
  }

  const purchaseUnits = [
    { name: "Grama", abbreviation: "g", kind: PurchaseUnitKind.WEIGHT },
    { name: "Quilograma", abbreviation: "kg", kind: PurchaseUnitKind.WEIGHT },
    { name: "Unidade", abbreviation: "un", kind: PurchaseUnitKind.COUNT },
    { name: "Pacote", abbreviation: "pct", kind: PurchaseUnitKind.PACKAGE },
  ];

  for (const unit of purchaseUnits) {
    await prisma.purchaseUnit.upsert({
      where: {
        tenantId_abbreviation: {
          tenantId: tenant.id,
          abbreviation: unit.abbreviation,
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        ...unit,
      },
    });
  }

  const orderPlatforms = [
    { name: "WhatsApp", feeRate: 0, paymentFeeRate: 0 },
    { name: "iFood", feeRate: 0.12, paymentFeeRate: 0.035 },
    { name: "99Food", feeRate: 0.1, paymentFeeRate: 0.035 },
    { name: "Keeta", feeRate: 0.1, paymentFeeRate: 0.035 },
  ];

  for (const platform of orderPlatforms) {
    await prisma.orderPlatform.upsert({
      where: {
        tenantId_name: {
          tenantId: tenant.id,
          name: platform.name,
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        ...platform,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
