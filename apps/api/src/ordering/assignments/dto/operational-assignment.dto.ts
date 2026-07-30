import { Type } from "class-transformer";
import { IsInt, IsString, IsUUID, MaxLength, Min, MinLength } from "class-validator";

export class ClaimOperationalAssignmentDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedVersion!: number;
}

export class TransferOperationalAssignmentDto extends ClaimOperationalAssignmentDto {
  @IsUUID()
  assigneeUserId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason!: string;
}
