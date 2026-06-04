import { OrderStatus } from "@prisma/client";
import { IsBooleanString, IsDateString, IsEnum, IsOptional, IsString } from "class-validator";

export class OrderMaintenanceQueryDto {
  @IsOptional()
  @IsDateString()
  start?: string;

  @IsOptional()
  @IsDateString()
  end?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsBooleanString()
  includeDeleted?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
