import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsEmail,
  IsOptional,
  IsString,
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

export class CreateStoreDto {
  @IsString()
  name!: string;

  @IsString()
  slug!: string;

  @IsString()
  phone!: string;

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
  phone?: string;

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
