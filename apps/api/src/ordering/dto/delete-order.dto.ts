import { IsDateString, IsString, MinLength } from "class-validator";

export class DeleteOrderDto {
  @IsDateString()
  expectedUpdatedAt!: string;

  @IsString()
  @MinLength(3)
  reason!: string;
}
