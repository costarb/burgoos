import { IsOptional, IsUrl, MaxLength } from "class-validator";

export class UpdatePagBankPlatformConfigurationDto {
  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ["http", "https"] })
  @MaxLength(2000)
  apiBaseUrl?: string;
}
