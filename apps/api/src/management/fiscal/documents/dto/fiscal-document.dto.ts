import { FiscalDocumentStatus } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

const toArray = ({ value }: { value: unknown }) =>
  value === undefined ? undefined : Array.isArray(value) ? value : String(value).split(",").filter(Boolean);

export class FiscalDocumentQueryDto {
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsEnum(FiscalDocumentStatus, { each: true })
  status?: FiscalDocumentStatus[];

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsOptional()
  @IsUUID()
  serviceTabId?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  pendingOnly?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class FiscalTargetDto {
  @IsIn(["ORDER", "TAB"])
  type!: "ORDER" | "TAB";

  @IsUUID()
  id!: string;
}

export class FiscalEmissionDto {
  @ValidateNested()
  @Type(() => FiscalTargetDto)
  target!: FiscalTargetDto;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  consumerDocument?: string | null;

  @IsOptional()
  @IsBoolean()
  confirmRetroactive?: boolean;
}

export class FiscalReprocessDto {
  @IsOptional()
  @IsBoolean()
  confirmRetroactive?: boolean;
}

export class FiscalCancelDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(15)
  @MaxLength(255)
  reason!: string;
}
