import {
  ChargeMode,
  PaymentInstitution,
  PaymentMethod,
  PaymentTargetType,
} from "@prisma/client";
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from "class-validator";

export class CreateChargeDto {
  @IsEnum(PaymentTargetType)
  targetType!: PaymentTargetType;

  @IsUUID()
  targetId!: string;

  @IsEnum(PaymentInstitution)
  institution!: PaymentInstitution;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsEnum(ChargeMode)
  mode!: ChargeMode;

  @IsString()
  @Matches(/^(0|[1-9]\d*)\.\d{2}$/)
  amount!: string;

  @IsOptional()
  @IsUUID()
  terminalId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  manualReference?: string;
}
