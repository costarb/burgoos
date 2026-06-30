import { ExportContext, ExportFormat } from "@prisma/client";
import { IsArray, IsEnum, IsObject, IsOptional, IsString } from "class-validator";

export class CreateExportJobDto {
  @IsEnum(ExportContext)
  context!: ExportContext;

  @IsEnum(ExportFormat)
  format!: ExportFormat;

  @IsObject()
  filters!: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  columns?: string[];
}
