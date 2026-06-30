import { PaymentInstitution, PaymentMethod } from "@prisma/client";
import { IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export type HistoricalOrderImportStrategy = "PRICE_WEIGHTED" | "FIXED_PRODUCT";
export type HistoricalOrderImportLayout = "SIMPLE" | "MERCADO_PAGO" | "PAGBANK";

export class ImportOrdersDto {
  @IsString()
  csvText!: string;

  @IsOptional()
  @IsIn(["SIMPLE", "MERCADO_PAGO", "PAGBANK"])
  layout?: HistoricalOrderImportLayout;

  @IsOptional()
  @IsIn(["PRICE_WEIGHTED", "FIXED_PRODUCT"])
  strategy?: HistoricalOrderImportStrategy;

  @IsOptional()
  @IsUUID()
  fixedProductId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  orderPlatformName?: string;

  @IsOptional()
  @IsEnum(PaymentInstitution)
  paymentInstitution?: PaymentInstitution;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}
