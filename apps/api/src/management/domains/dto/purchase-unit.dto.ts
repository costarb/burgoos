import { PurchaseUnitKind } from "@prisma/client";
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class PurchaseUnitDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsString()
  @MaxLength(12)
  abbreviation!: string;

  @IsEnum(PurchaseUnitKind)
  kind!: PurchaseUnitKind;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
