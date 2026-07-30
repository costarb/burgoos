import { IsString, Matches } from "class-validator";

const MONEY_PATTERN = /^(0|[1-9]\d*)\.\d{2}$/;

export class MoneyDto {
  @IsString()
  @Matches(MONEY_PATTERN, { message: "amount must use a non-negative decimal with two places" })
  amount!: string;
}

export function isMoney(value: string): boolean {
  return MONEY_PATTERN.test(value);
}
