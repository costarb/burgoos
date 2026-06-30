import { DeliveryProvider } from "@prisma/client";
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class DeliveryIntegrationDto {
  @IsEnum(DeliveryProvider)
  provider!: DeliveryProvider;

  @IsString()
  @MaxLength(80)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalMerchantId?: string | null;

  @IsUUID()
  orderPlatformId!: string;

  @IsOptional()
  @IsBoolean()
  pollingEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  webhookEnabled?: boolean;
}

export class DeliveryIntegrationUpdateDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalMerchantId?: string | null;

  @IsOptional()
  @IsBoolean()
  pollingEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  webhookEnabled?: boolean;
}

export class DeliveryCredentialDto {
  @IsOptional()
  @IsIn(["CENTRALIZED", "DISTRIBUTED"])
  authMode?: "CENTRALIZED" | "DISTRIBUTED";

  @IsString()
  clientId!: string;

  @IsString()
  clientSecret!: string;

  @IsOptional()
  @IsString()
  authorizationCode?: string | null;

  @IsOptional()
  @IsString()
  authorizationCodeVerifier?: string | null;

  @IsOptional()
  @IsString()
  refreshToken?: string | null;
}

export class DeliveryAuthorizationCodeDto {
  @IsString()
  clientId!: string;

  @IsString()
  clientSecret!: string;
}
