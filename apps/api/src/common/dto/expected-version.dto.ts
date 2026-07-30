import { IsInt, Min } from "class-validator";

export class ExpectedVersionDto {
  @IsInt()
  @Min(0)
  expectedVersion!: number;
}
