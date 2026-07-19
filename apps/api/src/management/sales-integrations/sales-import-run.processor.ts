import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../platform/database/prisma.service";
import { SalesImportConfirmationService } from "./sales-import-confirmation.service";
import { SalesImportPreviewService } from "./sales-import-preview.service";

@Injectable()
export class SalesImportRunProcessor implements OnModuleInit {
  private readonly logger = new Logger(SalesImportRunProcessor.name);
  private readonly active = new Set<string>();
  constructor(
    private readonly prisma: PrismaService,
    private readonly preview: SalesImportPreviewService,
    private readonly confirmation: SalesImportConfirmationService
  ) {}

  async onModuleInit() {
    if (!this.prisma?.salesImportRun) return;
    const recoverable = await this.prisma.salesImportRun.findMany({
      where: { status: { in: ["PENDING", "FETCHING", "IMPORTING"] } },
      select: { id: true, tenantId: true, status: true },
    });
    recoverable.forEach((run) =>
      run.status === "IMPORTING"
        ? this.queueConfirmation(run.id, run.tenantId)
        : this.queuePreview(run.id, run.tenantId)
    );
  }

  queuePreview(runId: string, tenantId: string) {
    this.runOnce(runId, tenantId, "preview");
  }
  queueConfirmation(runId: string, tenantId: string) {
    this.runOnce(runId, tenantId, "confirmation");
  }

  private runOnce(runId: string, tenantId: string, operation: "preview" | "confirmation") {
    if (this.active.has(runId)) return;
    this.active.add(runId);
    void (
      operation === "preview"
        ? this.preview.process(runId, tenantId)
        : this.confirmation.confirm(tenantId, runId, true)
    )
      .then((result) =>
        this.logger.log(
          JSON.stringify({
            event: `sales_import_${operation}_completed`,
            tenantId,
            runId,
            provider: result.provider,
            startDate: result.startDate,
            endDate: result.endDate,
            status: result.status,
            counts: result.counts,
          })
        )
      )
      .catch(async () => {
        await this.prisma.salesImportRun.updateMany({
          where: { id: runId, tenantId },
          data: {
            status: "FAILED",
            errorCode: "PROCESSING_FAILED",
            errorMessage: "Falha interna durante o processamento",
            completedAt: new Date(),
          },
        });
        this.logger.error(
          JSON.stringify({
            event: `sales_import_${operation}_failed`,
            tenantId,
            runId,
            code: "PROCESSING_FAILED",
          })
        );
      })
      .finally(() => this.active.delete(runId));
  }
}
