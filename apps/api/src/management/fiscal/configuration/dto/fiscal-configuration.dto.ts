import { FiscalEmissionMode, FiscalEnvironment, FiscalProvider, FiscalTaxRegime } from "@prisma/client";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

export class UpdateFiscalConfigurationDto {
  @IsBoolean()
  enabled!: boolean;

  @ValidateIf((_, value) => value !== null)
  @IsEnum(FiscalProvider)
  provider!: FiscalProvider | null;

  @IsEnum(FiscalEnvironment)
  environment!: FiscalEnvironment;

  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(999)
  series!: number | null;

  @IsEnum(FiscalEmissionMode)
  emissionMode!: FiscalEmissionMode;

  @Transform(trim)
  @IsString()
  @MinLength(15)
  @MaxLength(255)
  defaultCancelReason!: string;
}

export class UpdateFiscalIssuerDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  legalName!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  tradeName?: string | null;

  @IsString()
  @MaxLength(20)
  cnpj!: string;

  @IsString()
  @MaxLength(20)
  stateRegistration!: string;

  @IsEnum(FiscalTaxRegime)
  taxRegime!: FiscalTaxRegime;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(/^\d{7}$/, { message: "Codigo IBGE deve ter 7 digitos" })
  municipalityIbgeCode?: string | null;
}
