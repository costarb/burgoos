import { IsNumber, Max, Min } from "class-validator";

export class UpdateFinancialConfigurationDto {
  @IsNumber()
  @Min(0)
  @Max(1)
  taxRate!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  cardFeeRate!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  operationalLossRate!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  desiredMarginRate!: number;

  @IsNumber()
  @Min(0)
  averagePackagingCost!: number;

  @IsNumber()
  @Min(0)
  monthlyFixedCost!: number;

  @IsNumber()
  @Min(0)
  monthlyRevenueGoal!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  cmvWarningRate!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  netMarginGoalRate!: number;
}
