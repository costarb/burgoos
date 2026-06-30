import { AccessProfileScope, AccessProfileStatus } from "@prisma/client";
import { IsArray, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class AccessProfilesQueryDto {
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsEnum(AccessProfileStatus)
  status?: AccessProfileStatus;

  @IsOptional()
  @IsString()
  search?: string;
}

export class AccessProfileDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string | null;

  @IsEnum(AccessProfileScope)
  scope!: AccessProfileScope;

  @IsOptional()
  @IsUUID()
  storeId?: string | null;

  @IsArray()
  @IsString({ each: true })
  permissionKeys!: string[];
}

export class AccessProfileUpdateDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string | null;

  @IsOptional()
  @IsEnum(AccessProfileStatus)
  status?: AccessProfileStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionKeys?: string[];
}
