import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";

export class FiscalProfileDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsString()
  @MaxLength(10)
  ncm!: string;

  @IsString()
  @MaxLength(5)
  cfop!: string;

  @IsString()
  @MaxLength(3)
  csosn!: string;

  @IsInt()
  @Min(0)
  @Max(8)
  origin!: number;

  @IsString()
  @MaxLength(6)
  commercialUnit!: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(9)
  cest?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(10)
  benefitCode?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class FiscalProfileAssignmentDto {
  @IsUUID()
  id!: string;

  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  fiscalProfileId!: string | null;
}

export class FiscalProfileAssignmentsDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FiscalProfileAssignmentDto)
  categories?: FiscalProfileAssignmentDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FiscalProfileAssignmentDto)
  products?: FiscalProfileAssignmentDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FiscalProfileAssignmentDto)
  complements?: FiscalProfileAssignmentDto[];
}
