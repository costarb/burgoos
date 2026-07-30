import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { PaymentTargetType } from "@prisma/client";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { RequirePermission } from "../auth/guards/require-permission.decorator";
import { CurrentUser } from "../platform/auth/current-user.decorator";
import { AuthUser } from "../platform/auth/auth.types";
import { JwtAuthGuard } from "../platform/auth/jwt-auth.guard";
import { PaymentChargeService } from "./application/payment-charge.service";
import { CreateChargeDto } from "./application/dto/create-charge.dto";

@ApiTags("payments")
@ApiBearerAuth()
@Controller("admin/payment-charges")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PaymentChargeController {
  constructor(private readonly charges: PaymentChargeService) {}

  @Post()
  @ApiOperation({ summary: "Criar cobrança automática Mercado Pago Point" })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @RequirePermission("payments.charge")
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateChargeDto,
    @Headers("idempotency-key") key = "",
  ) {
    return this.charges.createAutomatic(user, dto, key || crypto.randomUUID());
  }

  @Get("active")
  @ApiOperation({ summary: "Consultar última cobrança de um pedido ou comanda" })
  @ApiQuery({ name: "targetType", enum: PaymentTargetType })
  @ApiQuery({ name: "targetId", schema: { type: "string", format: "uuid" } })
  @RequirePermission("payments.charge")
  active(
    @CurrentUser() user: AuthUser,
    @Query("targetType") targetType: PaymentTargetType,
    @Query("targetId") targetId: string,
  ) {
    return this.charges.active(user.tenantId, targetType, targetId);
  }

  @Get(":chargeId")
  @ApiOperation({ summary: "Consultar resultado sanitizado da cobrança" })
  @ApiParam({ name: "chargeId", format: "uuid" })
  @RequirePermission("payments.charge")
  get(@CurrentUser() user: AuthUser, @Param("chargeId") id: string) {
    return this.charges.get(user.tenantId, id);
  }

  @Post(":chargeId/refresh")
  @ApiOperation({ summary: "Reconciliar cobrança com o provedor" })
  @ApiParam({ name: "chargeId", format: "uuid" })
  @RequirePermission("payments.charge")
  refresh(@CurrentUser() user: AuthUser, @Param("chargeId") id: string) {
    return this.charges.refresh(user.tenantId, id);
  }

  @Post(":chargeId/cancel")
  @ApiOperation({ summary: "Cancelar tentativa de cobrança elegível" })
  @ApiParam({ name: "chargeId", format: "uuid" })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @RequirePermission("payments.cancel")
  cancel(
    @CurrentUser() user: AuthUser,
    @Param("chargeId") id: string,
    @Headers("idempotency-key") key = "",
  ) {
    return this.charges.cancel(user.tenantId, id, key || crypto.randomUUID());
  }
}
