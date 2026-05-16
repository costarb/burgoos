import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";
import { toMoneyString, toRateNumber } from "./money";
import { UpdateFinancialConfigurationDto } from "./dto/update-financial-configuration.dto";

@Injectable()
export class FinancialConfigurationService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get(tenantId: string) {
    const configuration = await this.prisma.financialConfiguration.upsert({
      where: {
        tenantId,
      },
      update: {},
      create: {
        tenantId,
      },
    });

    return this.toResponse(configuration);
  }

  async update(tenantId: string, dto: UpdateFinancialConfigurationDto) {
    const configuration = await this.prisma.financialConfiguration.upsert({
      where: {
        tenantId,
      },
      update: this.toData(dto),
      create: {
        tenantId,
        ...this.toData(dto),
      },
    });

    return this.toResponse(configuration);
  }

  private toData(dto: UpdateFinancialConfigurationDto) {
    return {
      taxRate: new Prisma.Decimal(dto.taxRate),
      cardFeeRate: new Prisma.Decimal(dto.cardFeeRate),
      operationalLossRate: new Prisma.Decimal(dto.operationalLossRate),
      desiredMarginRate: new Prisma.Decimal(dto.desiredMarginRate),
      averagePackagingCost: new Prisma.Decimal(dto.averagePackagingCost),
      monthlyFixedCost: new Prisma.Decimal(dto.monthlyFixedCost),
      monthlyRevenueGoal: new Prisma.Decimal(dto.monthlyRevenueGoal),
      cmvWarningRate: new Prisma.Decimal(dto.cmvWarningRate),
      netMarginGoalRate: new Prisma.Decimal(dto.netMarginGoalRate),
    };
  }

  private toResponse(configuration: {
    id: string;
    taxRate: Prisma.Decimal;
    cardFeeRate: Prisma.Decimal;
    operationalLossRate: Prisma.Decimal;
    desiredMarginRate: Prisma.Decimal;
    averagePackagingCost: Prisma.Decimal;
    monthlyFixedCost: Prisma.Decimal;
    monthlyRevenueGoal: Prisma.Decimal;
    cmvWarningRate: Prisma.Decimal;
    netMarginGoalRate: Prisma.Decimal;
  }) {
    return {
      id: configuration.id,
      taxRate: toRateNumber(configuration.taxRate),
      cardFeeRate: toRateNumber(configuration.cardFeeRate),
      operationalLossRate: toRateNumber(configuration.operationalLossRate),
      desiredMarginRate: toRateNumber(configuration.desiredMarginRate),
      averagePackagingCost: toMoneyString(configuration.averagePackagingCost),
      monthlyFixedCost: toMoneyString(configuration.monthlyFixedCost),
      monthlyRevenueGoal: toMoneyString(configuration.monthlyRevenueGoal),
      cmvWarningRate: toRateNumber(configuration.cmvWarningRate),
      netMarginGoalRate: toRateNumber(configuration.netMarginGoalRate),
    };
  }
}
