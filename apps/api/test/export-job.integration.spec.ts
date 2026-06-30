import { CanActivate, ExecutionContext, INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ExportContext, ExportFormat, ExportJobStatus, UserRole } from "@prisma/client";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PermissionGuard } from "../src/auth/guards/permission.guard";
import { ExportJobController } from "../src/management/exports/export-job.controller";
import { ExportJobService } from "../src/management/exports/export-job.service";
import { AuthenticatedRequest } from "../src/platform/auth/auth.types";
import { JwtAuthGuard } from "../src/platform/auth/jwt-auth.guard";
import { FinancialManagementRolesGuard } from "../src/platform/auth/roles.guard";

const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const exportId = "33333333-3333-4333-8333-333333333333";
const filePath = join(process.cwd(), "tmp", "export-integration", "contas-a-pagar.csv");

class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    req.user = {
      id: userId,
      tenantId,
      role: UserRole.ADMIN,
      email: "admin@burgoos.local",
      name: "Admin",
      permissions: ["finance.view", "finance.manage"],
    };
    return true;
  }
}

describe("export job integration", () => {
  let app: INestApplication;

  const exportJobService = {
    create: vi.fn(),
    get: vi.fn(),
    getDownload: vi.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ExportJobController],
      providers: [{ provide: ExportJobService, useValue: exportJobService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(TestAuthGuard)
      .overrideGuard(FinancialManagementRolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );
    await app.init();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await mkdir(join(process.cwd(), "tmp", "export-integration"), { recursive: true });
    await writeFile(filePath, "Conta,Previsto\r\nCompra,120.00\r\n");
    exportJobService.create.mockResolvedValue(exportJob());
    exportJobService.get.mockResolvedValue(exportJob({ status: ExportJobStatus.COMPLETED }));
    exportJobService.getDownload.mockResolvedValue({
      absolutePath: filePath,
      fileName: "contas-a-pagar.csv",
      mimeType: "text/csv; charset=utf-8",
    });
  });

  afterAll(async () => {
    await app?.close();
    await rm(join(process.cwd(), "tmp", "export-integration"), {
      force: true,
      recursive: true,
    });
  });

  it("accepts export requests asynchronously", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/admin/exports")
      .send({
        context: ExportContext.PAYABLES,
        format: ExportFormat.CSV,
        filters: { categoryId: "category-1" },
      })
      .expect(202);

    expect(exportJobService.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: userId, tenantId }),
      {
        context: ExportContext.PAYABLES,
        format: ExportFormat.CSV,
        filters: { categoryId: "category-1" },
      }
    );
    expect(response.body).toEqual(expect.objectContaining({ id: exportId, status: "PENDING" }));
  });

  it("returns status scoped to the authenticated user", async () => {
    await request(app.getHttpServer()).get(`/api/admin/exports/${exportId}`).expect(200);

    expect(exportJobService.get).toHaveBeenCalledWith(tenantId, userId, exportId);
  });

  it("downloads completed files through the export endpoint", async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/admin/exports/${exportId}/download`)
      .expect(200);

    expect(exportJobService.getDownload).toHaveBeenCalledWith(tenantId, userId, exportId);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.headers["content-disposition"]).toContain("contas-a-pagar.csv");
    expect(response.text).toContain("Compra,120.00");
  });
});

function exportJob(overrides: Partial<ReturnType<typeof baseExportJob>> = {}) {
  return { ...baseExportJob(), ...overrides };
}

function baseExportJob() {
  return {
    id: exportId,
    context: ExportContext.PAYABLES,
    format: ExportFormat.CSV,
    status: ExportJobStatus.PENDING as ExportJobStatus,
    filtersSnapshot: {},
    columnsSnapshot: null,
    requestedAt: "2026-06-30T12:00:00.000Z",
    startedAt: null,
    completedAt: null,
    failedAt: null,
    errorMessage: null,
    fileName: null,
    fileMimeType: null,
    fileSizeBytes: null,
    downloadUrl: null,
  };
}
