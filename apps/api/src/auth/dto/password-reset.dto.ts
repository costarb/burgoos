import { IsString, MinLength } from "class-validator";

export class PasswordResetRequestDto {
  @IsString()
  login!: string;
}

export class PasswordResetConfirmDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
