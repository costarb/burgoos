import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";

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

export class CreateStoreDto {
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

export class UpdateStoreDto {
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
