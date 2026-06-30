import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ProductCostStatus } from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";
import { toMoneyString } from "../financial/money";

interface PricingCalculationInput {
  ingredientCmv: Prisma.Decimal;
  explicitPackagingCost: Prisma.Decimal;
  hasExplicitPackaging: boolean;
  averagePackagingCost: Prisma.Decimal;
  operationalLossRate: Prisma.Decimal;
  currentPrice: Prisma.Decimal;
  desiredMarginRate: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  feeRate: Prisma.Decimal;
  paymentFeeRate: Prisma.Decimal;
  cmvWarningRate: Prisma.Decimal;
}

export function calculateProductPricing(input: PricingCalculationInput) {
  const packagingCost = input.hasExplicitPackaging
    ? new Prisma.Decimal(0)
    : input.averagePackagingCost;
  const subtotalCmv = input.ingredientCmv.add(packagingCost);
  const operationalLossCost = subtotalCmv.mul(input.operationalLossRate);
  const totalCmv = subtotalCmv.add(operationalLossCost);
  const totalRate = input.desiredMarginRate
    .add(input.taxRate)
    .add(input.feeRate)
    .add(input.paymentFeeRate);
  const divisor = Prisma.Decimal.max(
    new Prisma.Decimal("0.01"),
    new Prisma.Decimal(1).sub(totalRate)
  );
  const idealPrice = totalCmv.div(divisor);
  const cmvRate = input.currentPrice.gt(0)
    ? totalCmv.div(input.currentPrice)
    : new Prisma.Decimal(0);
  const feesAndTaxes = input.currentPrice.mul(
    input.taxRate.add(input.feeRate).add(input.paymentFeeRate)
  );
  const estimatedProfit = input.currentPrice.sub(totalCmv).sub(feesAndTaxes);
  const estimatedMarginRate = input.currentPrice.gt(0)
    ? estimatedProfit.div(input.currentPrice)
    : new Prisma.Decimal(0);
  const status =
    cmvRate.gt(input.cmvWarningRate) || input.currentPrice.lt(idealPrice)
      ? ProductCostStatus.REVIEW_PRICE
      : ProductCostStatus.OK;

  return {
    packagingCost,
    operationalLossCost,
    totalCmv,
    cmvRate,
    idealPrice,
    estimatedProfit,
    estimatedMarginRate,
    status,
  };
}

@Injectable()
export class ProductPricingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(tenantId: string, platformId?: string) {
    const [configuration, platform, products] = await Promise.all([
      this.getFinancialConfiguration(tenantId),
      platformId ? this.getPlatform(tenantId, platformId) : Promise.resolve(null),
      this.prisma.product.findMany({
        where: { tenantId },
        include: {
          technicalSheets: {
            where: { active: true },
            include: {
              lines: true,
            },
          },
        },
        orderBy: [{ name: "asc" }],
      }),
    ]);

    return products.map((product) => {
      const sheet = product.technicalSheets[0];

      if (!sheet || sheet.lines.length === 0) {
        return {
          productId: product.id,
          productName: product.name,
          currentPrice: toMoneyString(product.price),
          totalCmv: "0.00",
          cmvRate: 0,
          idealPrice: "0.00",
          estimatedProfit: "0.00",
          estimatedMarginRate: 0,
          status: ProductCostStatus.MISSING_TECHNICAL_SHEET,
        };
      }

      const ingredientCmv = sheet.lines.reduce(
        (total, line) => total.add(line.itemCost),
        new Prisma.Decimal(0)
      );
      const explicitPackagingCost = sheet.lines
        .filter((line) => line.isPackaging)
        .reduce((total, line) => total.add(line.itemCost), new Prisma.Decimal(0));
      const pricing = calculateProductPricing({
        ingredientCmv,
        explicitPackagingCost,
        hasExplicitPackaging: explicitPackagingCost.gt(0),
        averagePackagingCost: configuration.averagePackagingCost,
        operationalLossRate: configuration.operationalLossRate,
        currentPrice: product.price,
        desiredMarginRate: configuration.desiredMarginRate,
        taxRate: configuration.taxRate,
        feeRate: platform?.feeRate ?? new Prisma.Decimal(0),
        paymentFeeRate: platform?.paymentFeeRate ?? configuration.cardFeeRate,
        cmvWarningRate: configuration.cmvWarningRate,
      });

      return {
        productId: product.id,
        productName: product.name,
        currentPrice: toMoneyString(product.price),
        totalCmv: toMoneyString(pricing.totalCmv),
        cmvRate: pricing.cmvRate.toNumber(),
        idealPrice: toMoneyString(pricing.idealPrice),
        estimatedProfit: toMoneyString(pricing.estimatedProfit),
        estimatedMarginRate: pricing.estimatedMarginRate.toNumber(),
        status: pricing.status,
      };
    });
  }

  private async getFinancialConfiguration(tenantId: string) {
    return this.prisma.financialConfiguration.upsert({
      where: { tenantId },
      update: {},
      create: { tenantId },
    });
  }

  private async getPlatform(tenantId: string, platformId: string) {
    const platform = await this.prisma.orderPlatform.findFirst({
      where: {
        id: platformId,
        tenantId,
        active: true,
      },
    });

    if (!platform) {
      throw new NotFoundException("Order platform not found");
    }

    return platform;
  }
}
