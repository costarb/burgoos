import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Tenant } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";

export type TenantSummary = Pick<Tenant, "id" | "name" | "slug" | "phone" | "active" | "isOpen">;

@Injectable()
export class TenantContextService {
  private readonly logger = new Logger(TenantContextService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async resolveAdminTenant(tenantId: string): Promise<TenantSummary> {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        id: tenantId,
        active: true
      },
      select: this.tenantSelect
    });

    if (!tenant) {
      this.logger.warn(`Admin tenant resolution failed tenantId=${tenantId}`);
      throw new NotFoundException("Tenant not found");
    }

    return tenant;
  }

  async resolvePublicTenant(slug: string): Promise<TenantSummary> {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        slug,
        active: true
      },
      select: this.tenantSelect
    });

    if (!tenant) {
      this.logger.warn(`Public tenant resolution failed slug=${slug}`);
      throw new NotFoundException("Tenant not found");
    }

    return tenant;
  }

  private readonly tenantSelect = {
    id: true,
    name: true,
    slug: true,
    phone: true,
    active: true,
    isOpen: true
  } as const;
}
