import { IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from "class-validator";

export class StockMovementDto {
  @IsUUID()
  ingredientId!: string;

  @IsIn(["MANUAL_ENTRY", "MANUAL_ADJUSTMENT"])
  movementType!: "MANUAL_ENTRY" | "MANUAL_ADJUSTMENT";

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  reason?: string;
}
