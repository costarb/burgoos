import { Body, Controller, Get, Inject, Param, Post, Redirect, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsDateString, Matches } from "class-validator";
import { PermissionGuard } from "../../../auth/guards/permission.guard";
import { RequirePermission } from "../../../auth/guards/require-permission.decorator";
import type { AuthUser } from "../../../platform/auth/auth.types";
import { CurrentUser } from "../../../platform/auth/current-user.decorator";
import { JwtAuthGuard } from "../../../platform/auth/jwt-auth.guard";
import { IfoodFinancialReadinessService } from "./ifood-financial-readiness.service";
import { IfoodFinancialReconciliationProcessor } from "./ifood-financial-reconciliation.processor";
import { IfoodFinancialReconciliationService } from "./ifood-financial-reconciliation.service";

class CreateReconciliationDto {
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
}
class CreateReconciliationFileDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) competence!: string;
}

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller("admin/sales-integrations/:integrationId")
@ApiTags("iFood financial")
@ApiBearerAuth()
export class IfoodFinancialController {
  constructor(
    @Inject(IfoodFinancialReconciliationService)
    private readonly service: IfoodFinancialReconciliationService,
    @Inject(IfoodFinancialReconciliationProcessor)
    private readonly processor: IfoodFinancialReconciliationProcessor,
    @Inject(IfoodFinancialReadinessService)
    private readonly readiness: IfoodFinancialReadinessService
  ) {}

  @Get("ifood/readiness")
  @RequirePermission("integrations.sales.view", "integrations.sales.manage")
  getReadiness(@CurrentUser() user: AuthUser, @Param("integrationId") integrationId: string) {
    return this.readiness.get(user.tenantId, integrationId);
  }

  @Post("ifood/readiness")
  @RequirePermission("integrations.sales.manage")
  revalidateReadiness(
    @CurrentUser() user: AuthUser,
    @Param("integrationId") integrationId: string
  ) {
    return this.readiness.revalidate(user.tenantId, integrationId, user.id);
  }

  @Post("financial-reconciliations")
  @RequirePermission("integrations.sales.manage")
  async create(
    @CurrentUser() user: AuthUser,
    @Param("integrationId") integrationId: string,
    @Body() dto: CreateReconciliationDto
  ) {
    const run = await this.service.createRun(
      user.tenantId,
      user.id,
      integrationId,
      dto.startDate,
      dto.endDate
    );
    await this.processor.queue(run.id, user.tenantId);
    return this.view(run);
  }
  @Get("financial-reconciliations")
  @RequirePermission("integrations.sales.view", "integrations.sales.manage")
  async list(@CurrentUser() user: AuthUser, @Param("integrationId") integrationId: string) {
    return {
      items: (await this.service.listRuns(user.tenantId, integrationId)).map((run) =>
        this.view(run)
      ),
    };
  }
  @Get("financial-reconciliations/:runId")
  @RequirePermission("integrations.sales.view", "integrations.sales.manage")
  async get(
    @CurrentUser() user: AuthUser,
    @Param("integrationId") integrationId: string,
    @Param("runId") runId: string
  ) {
    return this.view(await this.service.getRun(user.tenantId, integrationId, runId));
  }
  @Post("reconciliation-files")
  @RequirePermission("integrations.sales.manage")
  requestFile(
    @CurrentUser() user: AuthUser,
    @Param("integrationId") integrationId: string,
    @Body() dto: CreateReconciliationFileDto
  ) {
    return this.service.requestFile(user.tenantId, integrationId, dto.competence);
  }
  @Get("reconciliation-files/:requestId")
  @RequirePermission("integrations.sales.view", "integrations.sales.manage")
  file(
    @CurrentUser() user: AuthUser,
    @Param("integrationId") integrationId: string,
    @Param("requestId") requestId: string
  ) {
    return this.service.refreshFile(user.tenantId, integrationId, requestId);
  }
  @Get("reconciliation-files/:requestId/download")
  @Redirect(undefined, 302)
  @RequirePermission("integrations.sales.view", "integrations.sales.manage")
  async download(
    @CurrentUser() user: AuthUser,
    @Param("integrationId") integrationId: string,
    @Param("requestId") requestId: string
  ) {
    return {
      url: await this.service.getDownloadUrl(user.tenantId, integrationId, requestId),
      statusCode: 302,
    };
  }

  private view(run: {
    id: string;
    status: string;
    trigger: string;
    startDate: Date;
    endDate: Date;
    salesCount: number;
    eventCount: number;
    settlementCount: number;
    divergentCount: number;
    errorCode: string | null;
    errorMessage: string | null;
  }) {
    return {
      id: run.id,
      status: run.status,
      trigger: run.trigger,
      startDate: run.startDate.toISOString().slice(0, 10),
      endDate: run.endDate.toISOString().slice(0, 10),
      counts: {
        sales: run.salesCount,
        events: run.eventCount,
        settlements: run.settlementCount,
        divergent: run.divergentCount,
      },
      errorCode: run.errorCode,
      errorMessage: run.errorMessage,
    };
  }
}
