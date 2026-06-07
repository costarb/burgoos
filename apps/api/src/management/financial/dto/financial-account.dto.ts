import { PaymentInstitution } from "@prisma/client";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class FinancialAccountDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsEnum(PaymentInstitution)
  paymentInstitution?: PaymentInstitution | null;

  @IsNumber()
  @Min(0)
  openingBalance!: number;

  @IsDateString()
  openingBalanceAt!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class FinancialCategoryDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
