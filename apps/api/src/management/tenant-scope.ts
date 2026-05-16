import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../platform/database/prisma.service";

@Injectable()
export class TenantScopeService {
  private readonly logger = new Logger(TenantScopeService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async ensureTenantRecord(
    model: "purchaseUnit" | "supplier" | "orderPlatform" | "ingredient",
    tenantId: string,
    id: string
  ): Promise<void> {
    const record = await this.findRecord(model, tenantId, id);

    if (!record) {
      this.logger.warn(`Tenant scope rejected model=${model} tenantId=${tenantId} id=${id}`);
      throw new NotFoundException("Registro nao encontrado");
    }
  }

  private findRecord(
    model: "purchaseUnit" | "supplier" | "orderPlatform" | "ingredient",
    tenantId: string,
    id: string
  ) {
    const where = { id, tenantId };
    const select = { id: true };

    switch (model) {
      case "purchaseUnit":
        return this.prisma.purchaseUnit.findFirst({ where, select });
      case "supplier":
        return this.prisma.supplier.findFirst({ where, select });
      case "orderPlatform":
        return this.prisma.orderPlatform.findFirst({ where, select });
      case "ingredient":
        return this.prisma.ingredient.findFirst({ where, select });
    }
  }
}
