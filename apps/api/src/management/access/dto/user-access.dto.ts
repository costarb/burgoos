import { AccessProfileStatus, AccessUserStatus } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from "class-validator";

export class AccessUsersQueryDto {
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsEnum(AccessUserStatus)
  status?: AccessUserStatus;

  @IsOptional()
  @IsUUID()
  profileId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export class UserStoreAssignmentDto {
  @IsUUID()
  storeId!: string;

  @IsUUID()
  profileId!: string;

  @IsBoolean()
  canManageStoreAccess!: boolean;

  @IsEnum(AccessProfileStatus)
  status!: AccessProfileStatus;
}

export class AccessUserDto {
  @IsString()
  @MaxLength(160)
  login!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsBoolean()
  isMaster!: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserStoreAssignmentDto)
  assignments!: UserStoreAssignmentDto[];
}

export class AccessUserUpdateDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @IsEnum(AccessUserStatus)
  status?: AccessUserStatus;

  @IsOptional()
  @IsBoolean()
  isMaster?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserStoreAssignmentDto)
  assignments?: UserStoreAssignmentDto[];
}
