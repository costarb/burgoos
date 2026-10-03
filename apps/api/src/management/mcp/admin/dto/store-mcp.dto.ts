import { McpDataArea, McpToolCallResult } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";

export const MCP_TOKEN_EXPIRATION_OPTIONS = [30, 90, 365] as const;

export class UpdateMcpConfigurationDto {
  @IsBoolean()
  enabled!: boolean;

  @IsArray()
  @ArrayUnique()
  @IsEnum(McpDataArea, { each: true })
  enabledAreas!: McpDataArea[];

  /** Write tools for OAuth connections granted actions; absent keeps the current value. */
  @IsOptional()
  @IsBoolean()
  actionsEnabled?: boolean;
}

export class CreateMcpTokenDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ValidateIf((_, value) => value !== null)
  @IsIn(MCP_TOKEN_EXPIRATION_OPTIONS)
  expiresInDays!: (typeof MCP_TOKEN_EXPIRATION_OPTIONS)[number] | null;
}

export class McpUsageQueryDto {
  @IsOptional()
  @IsUUID()
  tokenId?: string;

  @IsOptional()
  @IsDateString()
  start?: string;

  @IsOptional()
  @IsDateString()
  end?: string;

  @IsOptional()
  @IsEnum(McpToolCallResult)
  result?: McpToolCallResult;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
