import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../platform/database/prisma.service";
import { DeliveryIntegrationsService } from "../delivery-integrations.service";
import { IfoodClient } from "./ifood-client";

const TRACKING_REFRESH_INTERVAL_MS = 2 * 60_000;

@Injectable()
export class IfoodDeliveryTrackingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DeliveryIntegrationsService)
    private readonly integrationsService: DeliveryIntegrationsService,
    @Inject(IfoodClient) private readonly ifoodClient: IfoodClient
  ) {}

  async refreshIfDue(input: { tenantId: string; integrationId: string; externalOrderId: string }) {
    const link = await this.prisma.platformOrderLink.findFirst({
      where: {
        tenantId: input.tenantId,
        integrationId: input.integrationId,
        externalOrderId: input.externalOrderId,
        deliveryTrackingAvailable: true,
      },
    });

    if (!link || !this.isDue(link.lastProviderUpdateAt)) {
      return null;
    }

    const secret = await this.integrationsService.getActiveCredentialSecret(
      input.tenantId,
      input.integrationId
    );
    const tracking = await this.ifoodClient.getDeliveryTracking({
      accessToken: secret.accessToken,
      orderId: link.externalOrderId,
    });

    await this.prisma.platformOrderLink.update({
      where: { id: link.id },
      data: {
        rawOrderSnapshot: {
          ...(link.rawOrderSnapshot as Prisma.JsonObject),
          deliveryTracking: tracking as Prisma.InputJsonValue,
        },
        lastProviderUpdateAt: new Date(),
      },
    });

    return tracking;
  }

  private isDue(lastProviderUpdateAt: Date | null) {
    return (
      !lastProviderUpdateAt ||
      Date.now() - lastProviderUpdateAt.getTime() >= TRACKING_REFRESH_INTERVAL_MS
    );
  }
}
