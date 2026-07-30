import { randomInt } from "node:crypto";
import { PrismaService } from "../platform/database/prisma.service";

export async function nextOrderPublicCode(
  prisma: Pick<PrismaService, "order">,
  tenantId: string,
  now = new Date(),
): Promise<string> {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = String(randomInt(1, 1000)).padStart(3, "0");
    const exists = await prisma.order.count({
      where: { tenantId, publicCode: code, createdAt: { gte: start } },
    });
    if (!exists) return code;
  }
  throw new Error("Nao foi possivel gerar o codigo publico do pedido");
}
