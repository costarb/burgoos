import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../platform/database/prisma.service";
import { TenantScopeService } from "../tenant-scope";
import { PurchaseUnitDto } from "./dto/purchase-unit.dto";

@Injectable()
export class PurchaseUnitService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TenantScopeService) private readonly tenantScope: TenantScopeService
  ) {}

  list(tenantId: string) {
    return this.prisma.purchaseUnit.findMany({
      where: { tenantId },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });
  }

  create(tenantId: string, dto: PurchaseUnitDto) {
    return this.prisma.purchaseUnit.create({
      data: {
        tenantId,
        name: dto.name,
        abbreviation: dto.abbreviation,
        kind: dto.kind,
        active: dto.active ?? true,
      },
    });
  }

  async update(tenantId: string, id: string, dto: PurchaseUnitDto) {
    await this.tenantScope.ensureTenantRecord("purchaseUnit", tenantId, id);

    return this.prisma.purchaseUnit.update({
      where: { id },
      data: {
        name: dto.name,
        abbreviation: dto.abbreviation,
        kind: dto.kind,
        active: dto.active,
      },
    });
  }
}
