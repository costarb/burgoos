import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { PermissionGuard } from "../../auth/guards/permission.guard";
import { RequirePermission } from "../../auth/guards/require-permission.decorator";
import { AuthUser } from "../../platform/auth/auth.types";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import { CreateSalesImportRunDto, SalesPaginationDto } from "./dto/sales-integration.dto";
import { SalesImportPreviewService } from "./sales-import-preview.service";
import { SalesImportConfirmationService } from "./sales-import-confirmation.service";
import { SalesImportHistoryService } from "./sales-import-history.service";
import { SalesImportRunProcessor } from "./sales-import-run.processor";

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller("admin/sales-import-runs")
@ApiTags("Sales import runs")
@ApiBearerAuth()
export class SalesImportController {
  constructor(
    @Inject(SalesImportPreviewService) private readonly service: SalesImportPreviewService,
    @Inject(SalesImportConfirmationService)
    private readonly confirmation: SalesImportConfirmationService,
    @Inject(SalesImportHistoryService) private readonly history: SalesImportHistoryService,
    @Inject(SalesImportRunProcessor) private readonly processor: SalesImportRunProcessor
  ) {}
  @Get()
  @ApiOperation({ summary: "List tenant sales import runs" })
  @RequirePermission("integrations.sales.view", "integrations.sales.manage")
  list(@CurrentUser() user: AuthUser, @Query() query: SalesPaginationDto) {
    return this.history.list(user.tenantId, query);
  }
  @Post()
  @ApiOperation({ summary: "Start an asynchronous sales preview" })
  @ApiConflictResponse({ description: "Overlapping run or inactive integration" })
  @RequirePermission("integrations.sales.manage")
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateSalesImportRunDto) {
    const run = await this.service.create(user.tenantId, user.id, dto);
    await this.processor.queuePreview(run.id, user.tenantId);
    return run;
  }
  @Get(":id")
  @ApiOperation({ summary: "Poll a tenant-owned import run" })
  @ApiNotFoundResponse({ description: "Run not found" })
  @RequirePermission("integrations.sales.view", "integrations.sales.manage")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.get(user.tenantId, id);
  }
  @Post(":id/confirm")
  @ApiOperation({ summary: "Confirm an import run idempotently" })
  @ApiConflictResponse({ description: "Run is not ready" })
  @RequirePermission("integrations.sales.manage")
  async confirm(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const run = await this.service.get(user.tenantId, id);
    await this.processor.queueConfirmation(id, user.tenantId);
    return run;
  }
  @Get(":id/movements")
  @ApiOperation({ summary: "List filtered movement outcomes for a run" })
  @ApiNotFoundResponse({ description: "Run not found" })
  @RequirePermission("integrations.sales.view", "integrations.sales.manage")
  movements(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Query() query: SalesPaginationDto
  ) {
    return this.history.movements(user.tenantId, id, query);
  }
}
