import { FinancialRecurrenceFrequency } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class PayableRecurrenceDto {
  @IsEnum(FinancialRecurrenceFrequency)
  frequency!: FinancialRecurrenceFrequency;

  @IsInt()
  @Min(1)
  interval!: number;

  @IsDateString()
  startsOn!: string;

  @IsOptional()
  @IsDateString()
  endsOn?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  occurrenceCount?: number;
}

export class PayableDto {
  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string | null;

  @IsString()
  @MaxLength(160)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  documentReference?: string;

  @IsOptional()
  @IsDateString()
  competenceDate?: string;

  @IsDateString()
  dueDate!: string;

  @IsNumber()
  @Min(0.01)
  expectedAmount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PayableRecurrenceDto)
  recurrence?: PayableRecurrenceDto | null;
}

export class PayablePaymentDto {
  @IsUUID()
  financialAccountId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsDateString()
  paidAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class PayablesQueryDto {
  @IsOptional()
  @IsDateString()
  start?: string;

  @IsOptional()
  @IsDateString()
  end?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  competenceMonth?: string;
}

export class PayableCancellationDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class PayablePaymentReversalDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
}
