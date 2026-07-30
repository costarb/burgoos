import { Body, Controller, Get, Headers, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { PermissionGuard } from "../../auth/guards/permission.guard";
import { RequirePermission } from "../../auth/guards/require-permission.decorator";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { AuthUser } from "../../platform/auth/auth.types";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import {
  CancelManualPaymentDto,
  ConfirmManualPaymentDto,
} from "./dto/manual-payment.dto";
import { ManualPaymentReversalService } from "./manual-payment-reversal.service";
import { ManualPaymentService } from "./manual-payment.service";

@ApiTags("payments")
@ApiBearerAuth()
@Controller("admin/manual-payments")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ManualPaymentController {
  constructor(
    private readonly payments: ManualPaymentService,
    private readonly reversals: ManualPaymentReversalService,
  ) {}

  @Get("options")
  @ApiOperation({ summary: "Listar instituições e meios habilitados para pagamento manual" })
  @RequirePermission("payments.confirm-manual")
  options(@CurrentUser() user: AuthUser) {
    return this.payments.options(user.tenantId);
  }

  @Post()
  @ApiOperation({ summary: "Confirmar pagamento manual integral" })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @RequirePermission("payments.confirm-manual")
  confirm(
    @CurrentUser() user: AuthUser,
    @Body() dto: ConfirmManualPaymentDto,
    @Headers("idempotency-key") key = "",
  ) {
    return this.payments.confirm(user, dto, key || crypto.randomUUID());
  }

  @Post(":chargeId/cancel")
  @ApiOperation({ summary: "Estornar confirmação manual mediante justificativa" })
  @ApiParam({ name: "chargeId", format: "uuid" })
  @RequirePermission("payments.cancel")
  cancel(
    @CurrentUser() user: AuthUser,
    @Param("chargeId") chargeId: string,
    @Body() dto: CancelManualPaymentDto,
  ) {
    return this.reversals.cancel(user, chargeId, dto);
  }
}
