import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";

export class UpsertSalesIntegrationDto {
  @IsIn(["PAGBANK", "MERCADO_PAGO"])
  provider!: "PAGBANK" | "MERCADO_PAGO";
  @IsIn(["API"])
  channel!: "API";
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName!: string;
  @ValidateIf((value: UpsertSalesIntegrationDto) => value.provider === "PAGBANK")
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  externalMerchantId?: string;
  @IsOptional()
  @IsIn(["TEST", "PRODUCTION"])
  environment?: "TEST" | "PRODUCTION";
  @IsOptional()
  @IsIn(["PROVIDER_TOKEN", "OAUTH", "FIXED_TOKEN"])
  credentialMode?: "PROVIDER_TOKEN" | "OAUTH" | "FIXED_TOKEN";
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}

export class MercadoPagoCredentialModeDto {
  @IsIn(["OAUTH", "FIXED_TOKEN"])
  mode!: "OAUTH" | "FIXED_TOKEN";

  @ValidateIf((value: MercadoPagoCredentialModeDto) => value.mode === "FIXED_TOKEN")
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  accessToken?: string;
}

export class StartMercadoPagoOAuthDto {
  @IsOptional()
  @Type(() => Number)
  @IsIn([30, 60, 90])
  initialLoadDays: 30 | 60 | 90 = 30;
}

export class SalesCredentialDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  token!: string;
}

export class SalesIntegrationStatusDto {
  @IsIn(["ACTIVE", "PAUSED", "DISABLED"])
  status!: "ACTIVE" | "PAUSED" | "DISABLED";
}

export class CreateSalesImportRunDto {
  @IsUUID()
  integrationId!: string;
  @IsDateString()
  startDate!: string;
  @IsDateString()
  endDate!: string;
  @IsIn(["PRICE_WEIGHTED", "FIXED_PRODUCT"])
  strategy!: "PRICE_WEIGHTED" | "FIXED_PRODUCT";
  @ValidateIf((value: CreateSalesImportRunDto) => value.strategy === "FIXED_PRODUCT")
  @IsUUID()
  fixedProductId?: string;
}

export class MercadoPagoSyncDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsIn(["PRICE_WEIGHTED", "FIXED_PRODUCT"])
  strategy!: "PRICE_WEIGHTED" | "FIXED_PRODUCT";

  @ValidateIf((value: MercadoPagoSyncDto) => value.strategy === "FIXED_PRODUCT")
  @IsUUID()
  fixedProductId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsIn([30, 60, 90])
  initialPeriodDays?: 30 | 60 | 90;
}

export class SalesPaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
  @IsOptional()
  @IsIn(["NEW", "DUPLICATE", "REJECTED", "IMPORTED", "FAILED"])
  status?: string;
}
