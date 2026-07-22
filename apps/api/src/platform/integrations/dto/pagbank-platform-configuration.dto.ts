import { IsOptional, IsUrl, Matches, MaxLength } from "class-validator";

export class UpdatePagBankPlatformConfigurationDto {
  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ["http", "https"] })
  @MaxLength(2000)
  apiBaseUrl?: string;

  @IsOptional()
  @Matches(/^v\d+\.\d+$/, { message: "ediVersion must use the format v3.01" })
  ediVersion?: string;
}
