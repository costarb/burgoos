import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../platform/database/prisma.service";
import { TenantScopeService } from "../tenant-scope";
import { SupplierDto } from "./dto/supplier.dto";

@Injectable()
export class SupplierService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TenantScopeService) private readonly tenantScope: TenantScopeService
  ) {}

  list(tenantId: string) {
    return this.prisma.supplier.findMany({
      where: { tenantId },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });
  }

  create(tenantId: string, dto: SupplierDto) {
    return this.prisma.supplier.create({
      data: {
        tenantId,
        name: dto.name,
        category: dto.category,
        contactName: dto.contactName,
        phone: dto.phone,
        email: dto.email,
        notes: dto.notes,
        active: dto.active ?? true,
      },
    });
  }

  async update(tenantId: string, id: string, dto: SupplierDto) {
    await this.tenantScope.ensureTenantRecord("supplier", tenantId, id);

    return this.prisma.supplier.update({
      where: { id },
      data: {
        name: dto.name,
        category: dto.category,
        contactName: dto.contactName,
        phone: dto.phone,
        email: dto.email,
        notes: dto.notes,
        active: dto.active,
      },
    });
  }
}
