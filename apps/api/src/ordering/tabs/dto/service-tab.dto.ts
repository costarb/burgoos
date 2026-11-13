import { Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class OpenServiceTabDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  number!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateServiceTabDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class TabVersionDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedVersion!: number;
}

export class CheckoutServiceTabDto extends TabVersionDto {
  /** CPF/CNPJ for the NFC-e ("CPF na nota"); validated by check digits in the service. */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  consumerDocument?: string | null;
}

export class ReopenServiceTabDto extends TabVersionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason!: string;
}

export class CancelServiceTabDto extends ReopenServiceTabDto {}
