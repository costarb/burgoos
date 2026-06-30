import { IsString, MinLength } from "class-validator";

export class AccessLoginDto {
  @IsString()
  login!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken!: string;
}
