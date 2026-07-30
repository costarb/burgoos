import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { PaymentExceptionStatus } from "@prisma/client";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { RequirePermission } from "../auth/guards/require-permission.decorator";
import { CurrentUser } from "../platform/auth/current-user.decorator";
import { AuthUser } from "../platform/auth/auth.types";
import { JwtAuthGuard } from "../platform/auth/jwt-auth.guard";
import { PaymentExceptionResolutionService } from "./application/payment-exception-resolution.service";
import { PaymentExceptionService } from "./application/payment-exception.service";

@ApiTags("payments")
@ApiBearerAuth()
@Controller("admin/payment-exceptions")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PaymentExceptionController {
  constructor(
    private readonly exceptions: PaymentExceptionService,
    private readonly resolutions: PaymentExceptionResolutionService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Listar exceções financeiras para conferência" })
  @ApiQuery({ name: "status", required: false, enum: PaymentExceptionStatus })
  @RequirePermission("payment-exceptions.view")
  list(@CurrentUser() user: AuthUser, @Query("status") status?: PaymentExceptionStatus) {
    return this.exceptions.list(user.tenantId, status);
  }

  @Get(":id")
  @ApiOperation({ summary: "Consultar exceção e linha do tempo de auditoria" })
  @ApiParam({ name: "id", format: "uuid" })
  @RequirePermission("payment-exceptions.view")
  detail(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.exceptions.detail(user.tenantId, id);
  }

  @Patch(":id/resolve")
  @ApiOperation({ summary: "Resolver exceção financeira mediante justificativa" })
  @ApiParam({ name: "id", format: "uuid" })
  @RequirePermission("payments.reconcile")
  resolve(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { resolution?: string },
  ) {
    return this.resolutions.finish(user, id, "RESOLVED", body.resolution ?? "");
  }

  @Patch(":id/dismiss")
  @ApiOperation({ summary: "Descartar falso positivo mediante justificativa" })
  @ApiParam({ name: "id", format: "uuid" })
  @RequirePermission("payments.reconcile")
  dismiss(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { resolution?: string },
  ) {
    return this.resolutions.finish(user, id, "DISMISSED", body.resolution ?? "");
  }
}
