import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from "class-validator";

export class UpdateMercadoPagoPlatformConfigurationDto {
  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ["http", "https"] })
  @MaxLength(2000)
  apiBaseUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  clientId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  clientSecret?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  webhookSecret?: string;

  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ["http", "https"] })
  @MaxLength(2000)
  redirectUri?: string;

  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ["http", "https"] })
  @MaxLength(2000)
  postCallbackUrl?: string;
}
