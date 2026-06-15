import { IsOptional, IsString, MaxLength } from "class-validator";

export class RefusePlatformOrderDto {
  @IsString()
  @MaxLength(80)
  providerReasonId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}
