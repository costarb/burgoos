import { IsIn, IsOptional, IsString, IsUrl, Matches } from "class-validator";

export class StoreBrandingDto {
  @IsOptional()
  @IsUrl({ require_protocol: true })
  logoUrl?: string | null;

  @Matches(/^#[0-9a-fA-F]{6}$/)
  primaryColor!: string;

  @Matches(/^#[0-9a-fA-F]{6}$/)
  accentColor!: string;

  @IsIn(["LIGHT", "DARK", "SYSTEM_DEFAULT"])
  neutralTheme!: "LIGHT" | "DARK" | "SYSTEM_DEFAULT";

  @IsString()
  layoutPreset!: string;
}
