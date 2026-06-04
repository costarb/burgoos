import {
  FulfillmentMethod,
  PaymentInstitution,
  PaymentMethod,
} from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";

export class EditOrderItemDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsUUID()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  productNameSnapshot!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsNumberString()
  unitPrice!: string;
}

export class EditOrderDto {
  @IsDateString()
  expectedUpdatedAt!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsString()
  @IsNotEmpty()
  customerName!: string;

  @IsString()
  customerPhone!: string;

  @IsEnum(FulfillmentMethod)
  fulfillmentMethod!: FulfillmentMethod;

  @IsOptional()
  @IsObject()
  deliveryAddress?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsDateString()
  createdAt!: string;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsOptional()
  @IsEnum(PaymentInstitution)
  paymentInstitution?: PaymentInstitution | null;

  @IsOptional()
  @IsString()
  externalPaymentId?: string | null;

  @IsOptional()
  @IsNumberString()
  paymentGrossAmount?: string | null;

  @IsOptional()
  @IsNumberString()
  paymentFeeAmount?: string | null;

  @IsOptional()
  @IsNumberString()
  paymentNetAmount?: string | null;

  @IsOptional()
  @IsString()
  paymentBrand?: string | null;

  @IsOptional()
  @IsDateString()
  paymentReleaseExpectedAt?: string | null;

  @IsOptional()
  @IsUUID()
  orderPlatformId?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EditOrderItemDto)
  items!: EditOrderItemDto[];
}
