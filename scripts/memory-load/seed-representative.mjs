import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const orderCount = positiveInteger(process.argv[2] ?? "5000", "order count");
const batchSize = 250;

try {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "piloto" } });
  let products = await prisma.product.findMany({
    where: { tenantId: tenant.id, active: true },
    select: { id: true, name: true, price: true },
    take: 3,
  });
  if (products.length === 0) {
    const category = await prisma.category.create({
      data: { tenantId: tenant.id, name: "Memory Validation", sortOrder: 999, active: true },
    });
    await prisma.product.createMany({
      data: [
        { tenantId: tenant.id, categoryId: category.id, name: "Memory Burger", description: "Validation fixture", price: "29.90" },
        { tenantId: tenant.id, categoryId: category.id, name: "Memory Combo", description: "Validation fixture", price: "39.90" },
        { tenantId: tenant.id, categoryId: category.id, name: "Memory Drink", description: "Validation fixture", price: "9.90" },
      ],
    });
    products = await prisma.product.findMany({
      where: { tenantId: tenant.id, categoryId: category.id },
      select: { id: true, name: true, price: true },
      orderBy: { name: "asc" },
    });
  }

  const marker = "memory-validation";
  const existing = await prisma.order.count({
    where: { tenantId: tenant.id, notes: { startsWith: marker } },
  });
  if (existing >= orderCount) {
    process.stdout.write(`Representative seed already contains ${existing} orders\n`);
    process.exitCode = 0;
  } else {
    for (let offset = existing; offset < orderCount; offset += batchSize) {
      const count = Math.min(batchSize, orderCount - offset);
      const orders = Array.from({ length: count }, (_, index) => {
        const sequence = offset + index;
        const product = products[sequence % products.length];
        const createdAt = new Date(Date.now() - (sequence % 31) * 86_400_000 - (sequence % 3600) * 1000);
        return {
          id: randomUUID(),
          tenantId: tenant.id,
          status: sequence % 11 === 0 ? "CANCELLED" : "DELIVERED",
          source: sequence % 3 === 0 ? "PUBLIC_MENU" : sequence % 3 === 1 ? "COUNTER" : "IFOOD",
          publicCode: `MV${String(sequence + 1).padStart(7, "0")}`,
          total: product.price,
          customerName: `Memory Validation ${sequence + 1}`,
          customerPhone: "5500000000000",
          fulfillmentMethod: sequence % 2 === 0 ? "DELIVERY" : "PICKUP",
          paymentMethod: sequence % 2 === 0 ? "PIX_MANUAL" : "CASH",
          notes: `${marker}:${sequence + 1}`,
          createdAt,
          updatedAt: createdAt,
          completedAt: sequence % 11 === 0 ? null : createdAt,
        };
      });
      await prisma.order.createMany({ data: orders });
      await prisma.orderItem.createMany({
        data: orders.flatMap((order, index) => {
          const product = products[(offset + index) % products.length];
          return [1, 2, 3].map((quantity) => ({
            id: randomUUID(),
            tenantId: tenant.id,
            orderId: order.id,
            productId: product.id,
            productNameSnapshot: product.name,
            quantity,
            unitPrice: product.price,
            total: product.price.mul(quantity),
          }));
        }),
      });
      process.stdout.write(`Seeded ${Math.min(offset + count, orderCount)}/${orderCount} representative orders\n`);
    }
  }
} finally {
  await prisma.$disconnect();
}

function positiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`Invalid ${label}: ${value}`);
  return parsed;
}
