import { IsUUID } from "class-validator";

export class StoreContextDto {
  @IsUUID()
  storeId!: string;
}
