import { IsUUID } from "class-validator";

export class ApproveAuthorizationDto {
  @IsUUID()
  storeId!: string;
}
