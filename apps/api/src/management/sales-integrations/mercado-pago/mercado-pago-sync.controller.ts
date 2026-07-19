import { Body, Controller, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PermissionGuard } from "../../../auth/guards/permission.guard";
import { RequirePermission } from "../../../auth/guards/require-permission.decorator";
import { AuthUser } from "../../../platform/auth/auth.types";
import { CurrentUser } from "../../../platform/auth/current-user.decorator";
import { JwtAuthGuard } from "../../../platform/auth/jwt-auth.guard";
import { MercadoPagoSyncDto } from "../dto/sales-integration.dto";
import { SalesImportPreviewService } from "../sales-import-preview.service";
import { SalesImportRunProcessor } from "../sales-import-run.processor";

@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission("integrations.sales.manage")
@Controller("admin/sales-integrations/:integrationId/mercado-pago")
@ApiTags("Mercado Pago synchronization")
@ApiBearerAuth()
export class MercadoPagoSyncController {
  constructor(
    @Inject(SalesImportPreviewService) private readonly preview: SalesImportPreviewService,
    @Inject(SalesImportRunProcessor) private readonly processor: SalesImportRunProcessor
  ) {}

  @Post("sync")
  @ApiOperation({ summary: "Start a Mercado Pago initial or custom period preview" })
  async sync(
    @CurrentUser() user: AuthUser,
    @Param("integrationId") integrationId: string,
    @Body() dto: MercadoPagoSyncDto
  ) {
    const dates = dto.initialPeriodDays
      ? period(dto.initialPeriodDays)
      : { startDate: dto.startDate, endDate: dto.endDate };
    const run = await this.preview.create(
      user.tenantId,
      user.id,
      { ...dto, integrationId, ...dates },
      dto.initialPeriodDays ? "INITIAL_LOAD" : "MANUAL"
    );
    this.processor.queuePreview(run.id, user.tenantId);
    return run;
  }
}

export function period(days: 30 | 60 | 90, now = new Date()) {
  const end = new Date(now);
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}
