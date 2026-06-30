import { CashMovementType } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";

export class CashMovementDto {
  @IsEnum(CashMovementType)
  type!: CashMovementType;

  @IsUUID()
  financialAccountId!: string;

  @IsOptional()
  @IsUUID()
  destinationAccountId?: string | null;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsDateString()
  occurredAt!: string;

  @IsString()
  @MaxLength(160)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  justification?: string;
}

export class CashPositionQueryDto {
  @IsDateString()
  asOf!: string;

  @IsDateString()
  projectionEnd!: string;

  @IsOptional()
  @IsUUID()
  financialAccountId?: string;
}
