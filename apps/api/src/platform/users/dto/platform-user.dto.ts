import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class CreatePlatformUserDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsIn(["SUPER_ADMIN", "SUPPORT"])
  role!: "SUPER_ADMIN" | "SUPPORT";

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsString()
  @MinLength(6)
  temporaryPassword!: string;
}

export class UpdatePlatformUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsIn(["SUPER_ADMIN", "SUPPORT"])
  role?: "SUPER_ADMIN" | "SUPPORT";

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(6)
  temporaryPassword?: string;
}
