import { IsBoolean, IsOptional, IsUUID } from "class-validator";

export class ApproveAuthorizationDto {
  @IsUUID()
  storeId!: string;

  /** Explicit opt-in for write tools (granted only if the store and the user allow them). */
  @IsOptional()
  @IsBoolean()
  allowActions?: boolean;
}
