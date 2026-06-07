import {
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
    update: {},
    create: {
      tenantId: tenant.id,
      role: UserRole.OWNER,
      name: "Admin Piloto",
      email: "admin@burgoos.local",
      passwordHash,
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
