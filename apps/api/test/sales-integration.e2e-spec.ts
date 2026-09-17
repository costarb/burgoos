import { ConflictException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it, vi } from "vitest";
import { UpsertSalesIntegrationDto } from "../src/management/sales-integrations/dto/sales-integration.dto";
import { SalesIntegrationService } from "../src/management/sales-integrations/sales-integration.service";

const dto = {
  provider: "IFOOD" as const,
  channel: "API" as const,
  displayName: "iFood Financeiro",
  externalMerchantId: "merchant-1",
  environment: "PRODUCTION" as const,
  deliveryIntegrationId: "11111111-1111-4111-8111-111111111111",
};

describe("iFood sales integration contract", () => {
  it("requires the operational integration link", async () => {
    const value = plainToInstance(UpsertSalesIntegrationDto, {
      ...dto,
      deliveryIntegrationId: undefined,
    });
    const errors = await validate(value);
    expect(errors.some((error) => error.property === "deliveryIntegrationId")).toBe(true);
  });

  it("creates a linked integration without a copied sales credential", async () => {
    const delivery = {
      id: dto.deliveryIntegrationId,
      tenantId: "tenant-1",
      provider: "IFOOD",
      environment: "PRODUCTION",
      externalMerchantId: "merchant-1",
      credentials: [{ id: "credential-1" }],
    };
    const created = {
      id: "sales-1",
      ...dto,
      tenantId: "tenant-1",
      status: "DRAFT",
      credentialMode: "OAUTH",
      settings: {},
      financialReadiness: "PENDING_PERMISSION",
      providerUserId: null,
      tokenExpiresAt: null,
      scopes: [],
      connectedAt: null,
      lastSyncAt: null,
      disconnectedAt: null,
      lastValidationAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      credentials: [],
    };
    const prisma = {
      deliveryIntegration: { findFirst: vi.fn().mockResolvedValue(delivery) },
      salesIntegration: { create: vi.fn().mockResolvedValue(created) },
    };
    const service = new SalesIntegrationService(prisma as never, {} as never);
    const result = await service.create("tenant-1", "user-1", dto);
    expect(prisma.salesIntegration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deliveryIntegrationId: dto.deliveryIntegrationId,
          financialReadiness: "PENDING_PERMISSION",
        }),
      })
    );
    expect(JSON.stringify(prisma.salesIntegration.create.mock.calls)).not.toContain(
      "secretCiphertext"
    );
    expect(result.hasCredential).toBe(false);
  });

  it("rejects credential rotation because the operational credential is authoritative", async () => {
    const prisma = {
      salesIntegration: {
        findFirst: vi.fn().mockResolvedValue({ id: "sales-1", provider: "IFOOD", credentials: [] }),
      },
    };
    const service = new SalesIntegrationService(prisma as never, {} as never);
    await expect(
      service.rotateCredential("tenant-1", "user-1", "sales-1", { token: "must-not-copy" })
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
