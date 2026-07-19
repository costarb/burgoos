import { Injectable } from "@nestjs/common";
import {
  Prisma,
  SalesInputChannel,
  SalesIntegrationEnvironment,
  SalesProvider,
} from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";

export interface ExternalSaleIdentityKey {
  tenantId: string;
  provider: SalesProvider;
  externalSaleId: string;
  environment?: SalesIntegrationEnvironment;
  integrationId?: string;
}

@Injectable()
export class ExternalSaleIdentityService {
  constructor(private readonly prisma: PrismaService) {}

  async claim(key: ExternalSaleIdentityKey, firstChannel: SalesInputChannel): Promise<boolean> {
    try {
      await this.prisma.externalSaleIdentity.create({
        data: { ...key, environment: key.environment ?? "PRODUCTION", firstChannel },
      });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return false;
      }
      throw error;
    }
  }

  async release(key: ExternalSaleIdentityKey): Promise<void> {
    await this.prisma.externalSaleIdentity.deleteMany({
      where: { ...key, environment: key.environment ?? "PRODUCTION", orderId: null },
    });
  }

  async linkOrder(
    client: Prisma.TransactionClient,
    key: ExternalSaleIdentityKey,
    movementId: string,
    orderId: string
  ): Promise<void> {
    const importedAt = new Date();
    await client.externalSaleIdentity.update({
      where: {
        tenantId_provider_environment_externalSaleId: {
          tenantId: key.tenantId,
          provider: key.provider,
          environment: key.environment ?? "PRODUCTION",
          externalSaleId: key.externalSaleId,
        },
      },
      data: { orderId, importedAt },
    });
    await client.externalSalesMovement.update({
      where: { id: movementId },
      data: { status: "IMPORTED", orderId, importedAt },
    });
  }
}
