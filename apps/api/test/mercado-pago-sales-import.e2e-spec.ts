/* eslint-disable @typescript-eslint/no-explicit-any */
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { ExternalSaleIdentityService } from "../src/management/sales-integrations/external-sale-identity.service";

describe("Mercado Pago repeated import isolation", () => {
  it("creates no duplicate identity on a repeated preview and isolates two establishments", async () => {
    const identities = new Set<string>();
    const prisma: any = {
      externalSaleIdentity: {
        create: async ({ data }: any) => {
          const key = `${data.tenantId}:${data.provider}:${data.environment}:${data.externalSaleId}`;
          if (identities.has(key))
            throw new Prisma.PrismaClientKnownRequestError("duplicate", {
              code: "P2002",
              clientVersion: "test",
            });
          identities.add(key);
        },
        deleteMany: async () => ({ count: 0 }),
      },
    };
    const service = new ExternalSaleIdentityService(prisma);
    const sale = {
      provider: "MERCADO_PAGO" as const,
      environment: "PRODUCTION" as const,
      externalSaleId: "payment-987",
      integrationId: "connection-a",
    };
    await expect(service.claim({ tenantId: "tenant-a", ...sale }, "API")).resolves.toBe(true);
    await expect(service.claim({ tenantId: "tenant-a", ...sale }, "API")).resolves.toBe(false);
    await expect(
      service.claim({ tenantId: "tenant-b", ...sale, integrationId: "connection-b" }, "API")
    ).resolves.toBe(true);
    expect(identities.size).toBe(2);
  });
});
