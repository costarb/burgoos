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

describe("sales history HTTP contract", () => {
  let app: INestApplication; const history = { list: vi.fn(), movements: vi.fn() };
  beforeAll(async () => { const module = await Test.createTestingModule({ controllers: [SalesImportController], providers: [{ provide: SalesImportPreviewService, useValue: {} }, { provide: SalesImportConfirmationService, useValue: {} }, { provide: SalesImportHistoryService, useValue: history }, { provide: SalesImportRunProcessor, useValue: {} }] }).overrideGuard(JwtAuthGuard).useValue({ canActivate: (context: { switchToHttp(): { getRequest(): { user?: unknown } } }) => { context.switchToHttp().getRequest().user = { id: "actor", tenantId: "tenant-a" }; return true; } }).overrideGuard(PermissionGuard).useValue({ canActivate: () => true }).compile(); app = module.createNestApplication(); app.setGlobalPrefix("api"); await app.init(); });
  afterAll(() => app.close());
  it("scopes run and movement history to the JWT tenant", async () => {
    history.list.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 }); history.movements.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });
    await request(app.getHttpServer()).get("/api/admin/sales-import-runs").expect(200); await request(app.getHttpServer()).get("/api/admin/sales-import-runs/run/movements?status=FAILED").expect(200);
    expect(history.list).toHaveBeenCalledWith("tenant-a", expect.any(Object)); expect(history.movements).toHaveBeenCalledWith("tenant-a", "run", expect.objectContaining({ status: "FAILED" }));
  });
});
