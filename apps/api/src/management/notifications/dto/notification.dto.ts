import { OperationalNotificationStatus } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";
import { Type } from "class-transformer";

export class NotificationsQueryDto {
  @IsOptional()
  @IsEnum(OperationalNotificationStatus)
  status?: OperationalNotificationStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
