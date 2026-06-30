import { Body, Controller, Get, Inject, Param, Post, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { PermissionGuard } from "../../auth/guards/permission.guard";
import { RequirePermission } from "../../auth/guards/require-permission.decorator";
import { AuthUser } from "../../platform/auth/auth.types";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import { FinancialManagementRolesGuard } from "../../platform/auth/roles.guard";
import { CreateExportJobDto } from "./dto/export-job.dto";
import { ExportJobService } from "./export-job.service";

@ApiTags("admin exports")
@ApiBearerAuth()
@Controller("admin/exports")
@UseGuards(JwtAuthGuard, FinancialManagementRolesGuard, PermissionGuard)
export class ExportJobController {
  constructor(@Inject(ExportJobService) private readonly exportJobService: ExportJobService) {}

  @Post()
  @RequirePermission("finance.view", "finance.manage")
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateExportJobDto,
    @Res() response: Response
  ) {
    const job = await this.exportJobService.create(user, dto);
    return response.status(202).json(job);
  }

  @Get(":exportId")
  @RequirePermission("finance.view", "finance.manage")
  get(@CurrentUser() user: AuthUser, @Param("exportId") exportId: string) {
    return this.exportJobService.get(user.tenantId, user.id, exportId);
  }
}
