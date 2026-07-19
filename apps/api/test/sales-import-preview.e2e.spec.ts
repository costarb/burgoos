import { INestApplication, ValidationPipe } from "@nestjs/common";
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

describe("sales preview HTTP contract", () => {
  let app: INestApplication; const preview = { create: vi.fn(), get: vi.fn() }; const processor = { queuePreview: vi.fn(), queueConfirmation: vi.fn() };
  beforeAll(async () => { const module = await Test.createTestingModule({ controllers: [SalesImportController], providers: [{ provide: SalesImportPreviewService, useValue: preview }, { provide: SalesImportConfirmationService, useValue: {} }, { provide: SalesImportHistoryService, useValue: {} }, { provide: SalesImportRunProcessor, useValue: processor }] }).overrideGuard(JwtAuthGuard).useValue({ canActivate: (context: { switchToHttp(): { getRequest(): { user?: unknown } } }) => { context.switchToHttp().getRequest().user = { id: "actor", tenantId: "tenant-a" }; return true; } }).overrideGuard(PermissionGuard).useValue({ canActivate: () => true }).compile(); app = module.createNestApplication(); app.setGlobalPrefix("api"); app.useGlobalPipes(new ValidationPipe({ transform: true })); await app.init(); });
  afterAll(() => app.close());
  it("starts, queues and polls a tenant-owned preview", async () => {
    const run = { id: "11111111-1111-4111-8111-111111111111", status: "PENDING" }; preview.create.mockResolvedValue(run); preview.get.mockResolvedValue({ ...run, status: "PREVIEW_READY" });
    await request(app.getHttpServer()).post("/api/admin/sales-import-runs").send({ integrationId: "22222222-2222-4222-8222-222222222222", startDate: "2026-07-01", endDate: "2026-07-02", strategy: "PRICE_WEIGHTED" }).expect(201);
    expect(preview.create).toHaveBeenCalledWith("tenant-a", "actor", expect.any(Object)); expect(processor.queuePreview).toHaveBeenCalledWith(run.id, "tenant-a");
    await request(app.getHttpServer()).get(`/api/admin/sales-import-runs/${run.id}`).expect(200).expect(({ body }) => expect(body.status).toBe("PREVIEW_READY"));
    expect(preview.get).toHaveBeenCalledWith("tenant-a", run.id);
  });
});
