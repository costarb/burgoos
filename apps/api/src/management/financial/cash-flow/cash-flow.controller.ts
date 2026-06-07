import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthUser } from "../../../platform/auth/auth.types";
import { CurrentUser } from "../../../platform/auth/current-user.decorator";
import { JwtAuthGuard } from "../../../platform/auth/jwt-auth.guard";
import { FinancialManagementRolesGuard } from "../../../platform/auth/roles.guard";
import { CashMovementDto } from "../dto/cash-flow.dto";
import { ReasonDto } from "../dto/financial-operation.dto";
import { CashMovementService } from "./cash-movement.service";
import { CashFlowService } from "./cash-flow.service";
import { FinancialAccountDto, FinancialCategoryDto } from "../dto/financial-account.dto";
import { FinancialAccountService } from "./financial-account.service";

@ApiTags("admin cash flow")
@ApiBearerAuth()
@Controller("admin/financial")
@UseGuards(JwtAuthGuard, FinancialManagementRolesGuard)
export class CashFlowController {
  constructor(
    private readonly financialAccountService: FinancialAccountService,
    private readonly cashFlowService: CashFlowService,
    private readonly cashMovementService: CashMovementService
  ) {}

  @Get("accounts")
  listAccounts(@CurrentUser() user: AuthUser) {
    return this.financialAccountService.listAccounts(user.tenantId);
  }

  @Post("accounts")
  createAccount(@CurrentUser() user: AuthUser, @Body() dto: FinancialAccountDto) {
    return this.financialAccountService.createAccount(user.tenantId, dto);
  }

  @Patch("accounts/:id")
  updateAccount(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: FinancialAccountDto) {
    return this.financialAccountService.updateAccount(user.tenantId, id, dto);
  }

  @Get("categories")
  listCategories(@CurrentUser() user: AuthUser) {
    return this.financialAccountService.listCategories(user.tenantId);
  }

  @Post("categories")
  createCategory(@CurrentUser() user: AuthUser, @Body() dto: FinancialCategoryDto) {
    return this.financialAccountService.createCategory(user.tenantId, dto);
  }

  @Patch("categories/:id")
  updateCategory(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: FinancialCategoryDto) {
    return this.financialAccountService.updateCategory(user.tenantId, id, dto);
  }

  @Get("cash-flow/position")
  getPosition(
    @CurrentUser() user: AuthUser,
    @Query("asOf") asOf?: string,
    @Query("projectionEnd") projectionEnd?: string,
    @Query("financialAccountId") financialAccountId?: string
  ) {
    const referenceDate = asOf ? endOfDay(parseDate(asOf)) : new Date();
    const endDate = projectionEnd ? endOfDay(parseDate(projectionEnd)) : addDays(referenceDate, 30);

    return this.cashFlowService.getPosition(user.tenantId, referenceDate, endDate, financialAccountId);
  }

  @Get("cash-flow/ledger")
  async getLedger(
    @CurrentUser() user: AuthUser,
    @Query("asOf") asOf?: string,
    @Query("financialAccountId") financialAccountId?: string
  ) {
    const referenceDate = asOf ? endOfDay(parseDate(asOf)) : new Date();
    const position = await this.cashFlowService.getPosition(user.tenantId, referenceDate, referenceDate, financialAccountId);
    return position.ledger;
  }

  @Get("cash-flow/statement")
  getStatement(
    @CurrentUser() user: AuthUser,
    @Query("start") start?: string,
    @Query("end") end?: string,
    @Query("financialAccountId") financialAccountId?: string
  ) {
    const endDate = end ? endOfDay(parseDate(end)) : new Date();
    const startDate = start ? parseDate(start) : addDays(endDate, -30);

    return this.cashFlowService.getStatement(user.tenantId, startDate, endDate, financialAccountId);
  }

  @Get("cash-flow/movements")
  listMovements(@CurrentUser() user: AuthUser, @Query("start") start?: string, @Query("end") end?: string) {
    return this.cashMovementService.list(
      user.tenantId,
      start ? parseDate(start) : undefined,
      end ? endOfDay(parseDate(end)) : undefined
    );
  }

  @Post("cash-flow/movements")
  createMovement(@CurrentUser() user: AuthUser, @Body() dto: CashMovementDto) {
    return this.cashMovementService.create(user, dto);
  }

  @Post("cash-flow/movements/:id/reverse")
  reverseMovement(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: ReasonDto) {
    return this.cashMovementService.reverse(user, id, dto);
  }

  @Get("cash-flow/movements/:id/audit")
  getMovementAudit(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.cashFlowService.getAuditHistory(user.tenantId, "cash_movement", id);
  }
}

function parseDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function endOfDay(value: Date): Date {
  const end = new Date(value);
  end.setHours(23, 59, 59, 999);
  return end;
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  next.setHours(23, 59, 59, 999);
  return next;
}
