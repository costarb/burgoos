import { FiscalEmissionMode, FiscalEnvironment, FiscalProvider } from "@prisma/client";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsString,
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
