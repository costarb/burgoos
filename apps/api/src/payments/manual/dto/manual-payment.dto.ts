import {
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
  MinLength,
} from "class-validator";

export class ConfirmManualPaymentDto {
  @IsEnum(PaymentTargetType)
  targetType!: PaymentTargetType;

  @IsUUID()
  targetId!: string;

  @IsEnum(PaymentInstitution)
  institution!: PaymentInstitution;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsString()
  @Matches(/^(0|[1-9]\d*)\.\d{2}$/)
  amount!: string;

  @IsOptional()
  @IsString()
  @Matches(/^(0|[1-9]\d*)\.\d{2}$/)
  cashReceivedAmount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  manualReference?: string;
}

export class CancelManualPaymentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason!: string;
}
