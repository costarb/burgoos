import { OrderStatus } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class UpdateKdsOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
