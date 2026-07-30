import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { FulfillmentMethod, ItemModificationType } from "@prisma/client";

export class CounterOrderItemModificationDto {
  @IsEnum(ItemModificationType)
  type!: ItemModificationType;

  @IsUUID()
  referenceId!: string;

  @Type(() => Number)
  @Min(0.001)
  quantity!: number;
}

export class CounterOrderItemDto {
  @IsUUID()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CounterOrderItemModificationDto)
  modifications?: CounterOrderItemModificationDto[];

  @IsOptional()
  @IsString()
  @Matches(/^(0|[1-9]\d*)\.\d{2}$/)
  chargedUnitPrice?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  priceOverrideReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}

export class CreateCounterOrderDto {
  @IsOptional()
  @IsUUID()
  serviceTabId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  customerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  customerPhone?: string;

  @IsEnum(FulfillmentMethod)
  fulfillmentMethod!: FulfillmentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  releaseToKds?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CounterOrderItemDto)
  items!: CounterOrderItemDto[];
}

export class UpdateCounterOrderDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  customerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  customerPhone?: string;

  @IsEnum(FulfillmentMethod)
  fulfillmentMethod!: FulfillmentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CounterOrderItemDto)
  items!: CounterOrderItemDto[];
}
