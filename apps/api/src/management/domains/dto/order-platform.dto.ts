import { IsBoolean, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class OrderPlatformDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  feeRate!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  paymentFeeRate?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
