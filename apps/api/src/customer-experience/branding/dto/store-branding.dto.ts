import { IsBoolean, IsIn, IsOptional, IsString, Matches } from "class-validator";

export class StoreBrandingDto {
  @IsOptional()
  @IsString()
  logoUrl?: string | null;

  @IsOptional()
  @IsString()
  headerImageUrl?: string | null;

  @IsOptional()
  @IsString()
  bodyImageUrl?: string | null;

  @IsOptional()
  @IsString()
  footerImageUrl?: string | null;

  @Matches(/^#[0-9a-fA-F]{6}$/)
  primaryColor!: string;

  @Matches(/^#[0-9a-fA-F]{6}$/)
  accentColor!: string;

  @IsIn(["LIGHT", "DARK", "SYSTEM_DEFAULT"])
  neutralTheme!: "LIGHT" | "DARK" | "SYSTEM_DEFAULT";

  @IsString()
  layoutPreset!: string;

  @IsOptional()
  @IsBoolean()
  showProductImages?: boolean;

  @IsOptional()
  @IsBoolean()
  showProductDescriptions?: boolean;

  @IsOptional()
  @IsBoolean()
  orderingEnabled?: boolean;
}
