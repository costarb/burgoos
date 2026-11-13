import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { PermissionGuard } from "../../../auth/guards/permission.guard";
import { RequirePermission } from "../../../auth/guards/require-permission.decorator";
import { AuthUser } from "../../../platform/auth/auth.types";
import { CurrentUser } from "../../../platform/auth/current-user.decorator";
import { JwtAuthGuard } from "../../../platform/auth/jwt-auth.guard";
import { FISCAL_PERMISSIONS } from "../fiscal-permissions";
import { FiscalCancelDto, FiscalDocumentQueryDto, FiscalEmissionDto, FiscalReprocessDto } from "./dto/fiscal-document.dto";
import { FiscalCancellationService } from "./fiscal-cancellation.service";
import { FiscalDocumentsService } from "./fiscal-documents.service";
import { FiscalEmissionService } from "./fiscal-emission.service";
import { FiscalSyncService } from "./fiscal-sync.service";
import { FiscalXmlExportService } from "./fiscal-xml-export.service";

@ApiTags("admin fiscal")
@ApiBearerAuth()
@Controller("admin/fiscal")
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission(FISCAL_PERMISSIONS.view)
export class FiscalDocumentsController {
  constructor(
    @Inject(FiscalDocumentsService) private readonly documents: FiscalDocumentsService,
    @Inject(FiscalEmissionService) private readonly emissions: FiscalEmissionService,
    @Inject(FiscalCancellationService) private readonly cancellations: FiscalCancellationService,
    @Inject(FiscalSyncService) private readonly sync: FiscalSyncService,
    @Inject(FiscalXmlExportService) private readonly xmlExport: FiscalXmlExportService
  ) {}

  /** ZIP with the period XMLs for the accountant (production notes unless asked otherwise). */
  @Get("exports/xml")
  async exportXml(
    @CurrentUser() user: AuthUser,
    @Query("from") from: string,
    @Query("to") to: string,
    @Query("environment") environment: string | undefined,
    @Res() response: Response
  ) {
    const file = await this.xmlExport.build(user.tenantId, {
      from,
      to,
      environment: environment === "HOMOLOGATION" ? "HOMOLOGATION" : "PRODUCTION",
    });
    await this.send(response, { content: file.content, contentType: "application/zip", fileName: file.fileName }, "attachment");
  }

  @Get("documents")
  list(@CurrentUser() user: AuthUser, @Query() query: FiscalDocumentQueryDto) {
    return this.documents.list(user.tenantId, {
      ...query,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }

  /** Paid sales of the day (São Paulo) without NFC-e, for manual emission. */
  @Get("unissued")
  unissued(@CurrentUser() user: AuthUser, @Query("date") date?: string) {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    return this.documents.unissued(user.tenantId, date || today);
  }

  @Get("order-status")
  @RequirePermission(FISCAL_PERMISSIONS.view, "orders.view")
  orderStatus(@CurrentUser() user: AuthUser, @Query("ids") ids?: string) {
    const list = (ids ?? "").split(",").map((id) => id.trim()).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
    return this.documents.statusByOrderIds(user.tenantId, list);
  }

  @Get("documents/:id")
  detail(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.documents.detail(user.tenantId, id);
  }

  @Get("documents/:id/xml")
  async xml(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Res() response: Response) {
    await this.send(response, await this.documents.file(user.tenantId, id, "xml"), "attachment");
  }

  @Get("documents/:id/danfe")
  async danfe(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Res() response: Response) {
    await this.send(response, await this.documents.file(user.tenantId, id, "danfe"), "inline");
  }

  @Post("emissions")
  @HttpCode(202)
  @RequirePermission(FISCAL_PERMISSIONS.issue)
  async emit(@CurrentUser() user: AuthUser, @Body() dto: FiscalEmissionDto) {
    const result = await this.emissions.request({
      tenantId: user.tenantId,
      target: dto.target,
      trigger: "MANUAL",
      actorUserId: user.id,
      consumerDocument: dto.consumerDocument,
      confirmRetroactive: dto.confirmRetroactive,
    });
    if (result.status === "SKIPPED") throw new ConflictException({ code: result.reason });
    return this.documents.detail(user.tenantId, result.document.id);
  }

  @Post("documents/:id/reprocess")
  @HttpCode(202)
  @RequirePermission(FISCAL_PERMISSIONS.issue)
  async reprocess(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: FiscalReprocessDto) {
    const document = await this.documents.require(user.tenantId, id);
    if (document.status === "ERROR") {
      await this.emissions.enqueue(document);
      return this.documents.detail(user.tenantId, id);
    }
    if (document.status !== "REJECTED") {
      throw new ConflictException({ code: "NOT_REPROCESSABLE", message: "Somente notas rejeitadas ou com erro podem ser reprocessadas" });
    }
    const result = await this.emissions.request({
      tenantId: user.tenantId,
      target: document.orderId ? { type: "ORDER", id: document.orderId } : { type: "TAB", id: document.serviceTabId as string },
      trigger: "MANUAL",
      actorUserId: user.id,
      consumerDocument: document.consumerDocument,
      confirmRetroactive: dto.confirmRetroactive,
    });
    if (result.status === "SKIPPED") throw new ConflictException({ code: result.reason });
    return this.documents.detail(user.tenantId, result.document.id);
  }

  @Post("documents/:id/cancel")
  @HttpCode(202)
  @RequirePermission(FISCAL_PERMISSIONS.cancel)
  async cancel(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: FiscalCancelDto) {
    const document = await this.documents.require(user.tenantId, id);
    if (!["AUTHORIZED", "PENDING", "PROCESSING", "ERROR"].includes(document.status)) {
      throw new ConflictException({ code: "NOT_CANCELLABLE", message: "NFC-e nao esta autorizada" });
    }
    await this.cancellations.start(document, dto.reason, user.id, "MANUAL");
    return this.documents.detail(user.tenantId, id);
  }

  /** The operator reviewed the provider tax rules for a note authorized with other CFOP/CSOSN. */
  @Post("documents/:id/tax-divergence/review")
  @HttpCode(200)
  @RequirePermission(FISCAL_PERMISSIONS.configure, FISCAL_PERMISSIONS.issue)
  reviewTaxDivergence(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.documents.reviewTaxDivergence(user.tenantId, id, user.id);
  }

  /** "Ja cancelei no provedor": checks the provider now instead of waiting for the next sync. */
  @Post("documents/:id/sync")
  @HttpCode(200)
  @RequirePermission(FISCAL_PERMISSIONS.cancel, FISCAL_PERMISSIONS.issue)
  async syncNow(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    const document = await this.documents.require(user.tenantId, id);
    if (document.externalId && ["PROCESSING", "CANCEL_PENDING", "CANCEL_FAILED"].includes(document.status)) {
      await this.sync.sync(document);
    }
    return this.documents.detail(user.tenantId, id);
  }

  private async send(
    response: Response,
    file: { content: Buffer; contentType: string; fileName: string } | { redirect: string },
    disposition: string
  ) {
    if ("redirect" in file) {
      response.redirect(302, file.redirect);
      return;
    }
    response.setHeader("Content-Type", file.contentType);
    response.setHeader("Content-Disposition", `${disposition}; filename="${file.fileName}"`);
    response.setHeader("Cache-Control", "private, no-store");
    response.send(file.content);
  }
}
