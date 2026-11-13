import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsObject,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { FiscalTaxRegime } from "@prisma/client";

/** Fiscal identity of the store (spec 029); validated against the address in the service. */
export class StoreLegalDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  legalName?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  tradeName?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(20)
  cnpj?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(20)
  stateRegistration?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEnum(FiscalTaxRegime)
  taxRegime?: FiscalTaxRegime | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(9)
  municipalityIbgeCode?: string | null;
}

export class CreateStoreOwnerDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  temporaryPassword!: string;
}

export class StoreAddressDto {
  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  number?: string;

  @IsOptional()
  @IsString()
  complement?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;
}

export class StoreSocialLinksDto {
  @IsOptional()
  @IsString()
  instagram?: string;

  @IsOptional()
  @IsString()
  facebook?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  website?: string;
}

export class CreateStoreDto extends StoreLegalDto {
  @IsString()
  name!: string;

  @IsString()
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(253)
  publicDomain?: string;

  @IsString()
  phone!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => StoreAddressDto)
  address?: StoreAddressDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => StoreSocialLinksDto)
  socialLinks?: StoreSocialLinksDto;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;

  @IsOptional()
  @IsIn(["SCHEDULE", "FORCE_OPEN", "FORCE_CLOSED"])
  openMode?: "SCHEDULE" | "FORCE_OPEN" | "FORCE_CLOSED";

  @IsOptional()
  @IsObject()
  operatingHours?: Record<string, unknown>;

  @ValidateNested()
  @Type(() => CreateStoreOwnerDto)
  owner!: CreateStoreOwnerDto;
}

export class UpdateStoreDto extends StoreLegalDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(253)
  publicDomain?: string | null;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => StoreAddressDto)
  address?: StoreAddressDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => StoreSocialLinksDto)
  socialLinks?: StoreSocialLinksDto;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;

  @IsOptional()
  @IsIn(["SCHEDULE", "FORCE_OPEN", "FORCE_CLOSED"])
  openMode?: "SCHEDULE" | "FORCE_OPEN" | "FORCE_CLOSED";

  @IsOptional()
  @IsObject()
  operatingHours?: Record<string, unknown>;
}

/**
 * What the store admin may change on its own store ("Dados da loja"): identity, contact and
 * fiscal data. Slug, public domain, activation and opening rules stay with the platform.
 */
export class StoreAdminProfileDto extends StoreLegalDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => StoreAddressDto)
  address?: StoreAddressDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => StoreSocialLinksDto)
  socialLinks?: StoreSocialLinksDto;
}
