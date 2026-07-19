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
  @IsIn(["PAGBANK"])
  provider!: "PAGBANK";
  @IsIn(["API"])
  channel!: "API";
  @IsString() @MinLength(1) @MaxLength(100)
  displayName!: string;
  @IsString() @MinLength(1) @MaxLength(100)
  externalMerchantId!: string;
  @IsOptional() @IsObject()
  settings?: Record<string, unknown>;
}

export class SalesCredentialDto {
  @IsString() @MinLength(1) @MaxLength(4000)
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

export class SalesPaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize = 20;
  @IsOptional() @IsIn(["NEW", "DUPLICATE", "REJECTED", "IMPORTED", "FAILED"])
  status?: string;
}
