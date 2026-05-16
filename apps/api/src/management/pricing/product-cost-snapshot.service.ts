import { Inject, Injectable } from "@nestjs/common";
import { Prisma, ProductCostStatus } from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";

interface ProductCostSnapshotInput {
  tenantId: string;
  productId: string;
  orderPlatformId?: string | null;
  ingredientCmv: Prisma.Decimal;
  packagingCost: Prisma.Decimal;
  operationalLossCost: Prisma.Decimal;
  totalCmv: Prisma.Decimal;
  currentPrice: Prisma.Decimal;
  cmvRate: Prisma.Decimal;
  desiredMarginRate: Prisma.Decimal;
  feeRate: Prisma.Decimal;
  idealPrice: Prisma.Decimal;
  estimatedProfit: Prisma.Decimal;
  estimatedMarginRate: Prisma.Decimal;
  status: ProductCostStatus;
}

@Injectable()
export class ProductCostSnapshotService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  create(input: ProductCostSnapshotInput) {
    return this.prisma.productCostSnapshot.create({
      data: input,
    });
  }
}
