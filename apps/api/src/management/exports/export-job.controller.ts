import { Body, Controller, Get, Inject, Param, Post, Res, UseGuards } from "@nestjs/common";
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
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
  @ApiOperation({ summary: "Request an asynchronous admin export job" })
  @ApiAcceptedResponse({ description: "Export job accepted for background processing." })
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
  @ApiOperation({ summary: "Get an admin export job status" })
  @ApiParam({ name: "exportId", description: "Export job identifier." })
  @ApiOkResponse({ description: "Export job status and download metadata." })
  @ApiNotFoundResponse({ description: "Export job not found for the authenticated user." })
  get(@CurrentUser() user: AuthUser, @Param("exportId") exportId: string) {
    return this.exportJobService.get(user.tenantId, user.id, exportId);
  }

  @Get(":exportId/download")
  @RequirePermission("finance.view", "finance.manage")
  @ApiOperation({ summary: "Download a completed admin export file" })
  @ApiParam({ name: "exportId", description: "Export job identifier." })
  @ApiOkResponse({ description: "Generated export file." })
  @ApiConflictResponse({ description: "Export is not completed or file metadata is unavailable." })
  @ApiNotFoundResponse({ description: "Export job not found for the authenticated user." })
  async download(
    @CurrentUser() user: AuthUser,
    @Param("exportId") exportId: string,
    @Res() response: Response
  ) {
    const file = await this.exportJobService.getDownload(user.tenantId, user.id, exportId);
    response.setHeader("Content-Type", file.mimeType);
    response.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
    if (file.contentLength !== undefined) {
      response.setHeader("Content-Length", file.contentLength);
    }
    file.body.pipe(response);
  }
}
