import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PermissionGuard } from "../../../auth/guards/permission.guard";
import { RequirePermission } from "../../../auth/guards/require-permission.decorator";
import { AuthUser } from "../../../platform/auth/auth.types";
import { CurrentUser } from "../../../platform/auth/current-user.decorator";
import { JwtAuthGuard } from "../../../platform/auth/jwt-auth.guard";
import { FinancialManagementRolesGuard } from "../../../platform/auth/roles.guard";
import {
  PayableCancellationDto,
  PayableDto,
  PayablePaymentDto,
  PayablePaymentReversalDto,
  PayablesQueryDto,
} from "../dto/payable.dto";
import { AccountsPayableService } from "./accounts-payable.service";

@ApiTags("admin accounts payable")
@ApiBearerAuth()
@Controller("admin/financial/payables")
@UseGuards(JwtAuthGuard, FinancialManagementRolesGuard, PermissionGuard)
export class AccountsPayableController {
  constructor(
    @Inject(AccountsPayableService) private readonly accountsPayableService: AccountsPayableService
  ) {}

  @Get()
  @RequirePermission("finance.view", "finance.manage")
  list(@CurrentUser() user: AuthUser, @Query() query: PayablesQueryDto) {
    return this.accountsPayableService.list(user.tenantId, query);
  }

  @Post()
  @RequirePermission("finance.manage")
  create(@CurrentUser() user: AuthUser, @Body() dto: PayableDto) {
    return this.accountsPayableService.create(user, dto);
  }

  @Get("options")
  @RequirePermission("finance.view", "finance.manage")
  getOptions(@CurrentUser() user: AuthUser) {
    return this.accountsPayableService.getOptions(user.tenantId);
  }

  @Get(":id/audit")
  @RequirePermission("finance.view", "finance.manage")
  getAuditHistory(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.accountsPayableService.getAuditHistory(user.tenantId, id);
  }

  @Get(":id")
  @RequirePermission("finance.view", "finance.manage")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.accountsPayableService.get(user.tenantId, id);
  }

  @Patch(":id")
  @RequirePermission("finance.manage")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: PayableDto) {
    return this.accountsPayableService.update(user, id, dto);
  }

  @Post(":id/cancel")
  @RequirePermission("finance.manage")
  cancel(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: PayableCancellationDto
  ) {
    return this.accountsPayableService.cancel(user, id, dto);
  }

  @Post(":id/payments")
  @RequirePermission("finance.manage")
  addPayment(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: PayablePaymentDto
  ) {
    return this.accountsPayableService.addPayment(user, id, dto);
  }

  @Post("payments/:paymentId/reverse")
  @RequirePermission("finance.manage")
  reversePayment(
    @CurrentUser() user: AuthUser,
    @Param("paymentId") paymentId: string,
    @Body() dto: PayablePaymentReversalDto
  ) {
    return this.accountsPayableService.reversePayment(user, paymentId, dto);
  }
}
