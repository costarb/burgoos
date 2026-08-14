import { OperationalNotificationStatus } from "@prisma/client";
import { IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";
import { Type } from "class-transformer";

export class NotificationsQueryDto {
  @IsOptional()
  @IsEnum(OperationalNotificationStatus)
  status?: OperationalNotificationStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @IsDateString()
  since?: string;
}
