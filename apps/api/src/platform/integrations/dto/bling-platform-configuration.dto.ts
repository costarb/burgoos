import { IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

export class UpdateBlingPlatformConfigurationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  clientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  clientSecret?: string;

  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  @MaxLength(500)
  postCallbackUrl?: string;
}
