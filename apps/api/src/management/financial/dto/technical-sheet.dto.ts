import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class TechnicalSheetLineDto {
  @IsUUID()
  ingredientId!: string;

  @IsNumber()
  @Min(0.001)
  quantityUsed!: number;

  @IsOptional()
  @IsBoolean()
  isPackaging?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  notes?: string;
}

export class ReplaceTechnicalSheetDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TechnicalSheetLineDto)
  lines!: TechnicalSheetLineDto[];
}
