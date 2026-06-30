import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from "class-validator";

export class IngredientDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(80)
  category!: string;

  @IsUUID()
  purchaseUnitId!: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsNumber()
  @Min(0.001)
  purchaseQuantity!: number;

  @IsNumber()
  @Min(0)
  purchaseCost!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  currentStock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumStock?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
