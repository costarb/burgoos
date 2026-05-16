import { PrismaClient, PurchaseUnitKind, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const passwordHash = await hash("admin123", 10);

  const tenant = await prisma.tenant.upsert({
    where: { slug: "piloto" },
    update: {},
    create: {
      name: "Loja Piloto",
      slug: "piloto",
      phone: "5500000000000",
      active: true,
      isOpen: true,
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
