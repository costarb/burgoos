import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PermissionGuard } from "../src/auth/guards/permission.guard";
import { SalesImportController } from "../src/management/sales-integrations/sales-import.controller";
import { SalesImportConfirmationService } from "../src/management/sales-integrations/sales-import-confirmation.service";
import { SalesImportHistoryService } from "../src/management/sales-integrations/sales-import-history.service";
import { SalesImportPreviewService } from "../src/management/sales-integrations/sales-import-preview.service";
import { SalesImportRunProcessor } from "../src/management/sales-integrations/sales-import-run.processor";
import { JwtAuthGuard } from "../src/platform/auth/jwt-auth.guard";

describe("sales confirmation HTTP contract", () => {
  let app: INestApplication; const preview = { get: vi.fn() }; const processor = { queueConfirmation: vi.fn() };
  beforeAll(async () => { const module = await Test.createTestingModule({ controllers: [SalesImportController], providers: [{ provide: SalesImportPreviewService, useValue: preview }, { provide: SalesImportConfirmationService, useValue: {} }, { provide: SalesImportHistoryService, useValue: {} }, { provide: SalesImportRunProcessor, useValue: processor }] }).overrideGuard(JwtAuthGuard).useValue({ canActivate: (context: { switchToHttp(): { getRequest(): { user?: unknown } } }) => { context.switchToHttp().getRequest().user = { id: "actor", tenantId: "tenant-a" }; return true; } }).overrideGuard(PermissionGuard).useValue({ canActivate: () => true }).compile(); app = module.createNestApplication(); app.setGlobalPrefix("api"); await app.init(); });
  afterAll(() => app.close());
  it("queues repeated confirmations idempotently with the authenticated tenant", async () => {
    preview.get.mockResolvedValue({ id: "run", status: "PREVIEW_READY" });
    await Promise.all([request(app.getHttpServer()).post("/api/admin/sales-import-runs/run/confirm").expect(201), request(app.getHttpServer()).post("/api/admin/sales-import-runs/run/confirm").expect(201)]);
    expect(preview.get).toHaveBeenCalledTimes(2); expect(preview.get).toHaveBeenCalledWith("tenant-a", "run"); expect(processor.queueConfirmation).toHaveBeenCalledWith("run", "tenant-a");
  });
});
