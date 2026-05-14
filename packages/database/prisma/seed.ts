import { PrismaClient, UserRole } from "@prisma/client";
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
        openingHours: "18:00-23:00"
      }
    }
  });

  await prisma.user.upsert({
    where: { email: "admin@burgoos.local" },
    update: {},
    create: {
      tenantId: tenant.id,
      role: UserRole.OWNER,
      name: "Admin Piloto",
      email: "admin@burgoos.local",
      passwordHash
    }
  });
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
