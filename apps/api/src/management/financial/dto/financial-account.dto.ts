import { PaymentInstitution } from "@prisma/client";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
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

  @IsOptional()
  @IsUUID()
  paymentInstitutionId?: string | null;

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

export class PaymentInstitutionConfigurationDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @IsOptional()
  @IsEnum(PaymentInstitution)
  paymentInstitution?: PaymentInstitution | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
