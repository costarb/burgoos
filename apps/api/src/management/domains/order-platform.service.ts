import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";
import { toRateNumber } from "../financial/money";
import { TenantScopeService } from "../tenant-scope";
import { OrderPlatformDto } from "./dto/order-platform.dto";

@Injectable()
export class OrderPlatformService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TenantScopeService) private readonly tenantScope: TenantScopeService
  ) {}

  async list(tenantId: string) {
    const platforms = await this.prisma.orderPlatform.findMany({
      where: { tenantId },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });

    return platforms.map((platform) => this.toResponse(platform));
  }

  async create(tenantId: string, dto: OrderPlatformDto) {
    const platform = await this.prisma.orderPlatform.create({
      data: {
        tenantId,
        name: dto.name,
        feeRate: new Prisma.Decimal(dto.feeRate),
        paymentFeeRate: new Prisma.Decimal(dto.paymentFeeRate ?? 0),
        active: dto.active ?? true,
      },
    });

    return this.toResponse(platform);
  }

  async update(tenantId: string, id: string, dto: OrderPlatformDto) {
    await this.tenantScope.ensureTenantRecord("orderPlatform", tenantId, id);

    const platform = await this.prisma.orderPlatform.update({
      where: { id },
      data: {
        name: dto.name,
        feeRate: new Prisma.Decimal(dto.feeRate),
        paymentFeeRate: new Prisma.Decimal(dto.paymentFeeRate ?? 0),
        active: dto.active,
      },
    });

    return this.toResponse(platform);
  }

  private toResponse(platform: {
    id: string;
    name: string;
    feeRate: Prisma.Decimal;
    paymentFeeRate: Prisma.Decimal;
    active: boolean;
  }) {
    return {
      id: platform.id,
      name: platform.name,
      feeRate: toRateNumber(platform.feeRate),
      paymentFeeRate: toRateNumber(platform.paymentFeeRate),
      active: platform.active,
    };
  }
}
