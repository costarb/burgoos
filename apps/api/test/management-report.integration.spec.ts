import { CanActivate, ExecutionContext, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { UserRole } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PermissionGuard } from "../src/auth/guards/permission.guard";
import { ManagementReportController } from "../src/management/reports/management-report.controller";
import { ManagementReportService } from "../src/management/reports/management-report.service";
import { AuthenticatedRequest } from "../src/platform/auth/auth.types";
import { JwtAuthGuard } from "../src/platform/auth/jwt-auth.guard";

const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    req.user = {
      id: userId,
      tenantId,
      role: UserRole.ADMIN,
      email: "admin@burgoos.local",
      name: "Admin",
      permissions: ["finance.view"],
    };
    return true;
  }
}

describe("management report integration", () => {
  let app: INestApplication;

  const managementReportService = {
    getReport: vi.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ManagementReportController],
      providers: [{ provide: ManagementReportService, useValue: managementReportService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(TestAuthGuard)
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    managementReportService.getReport.mockResolvedValue(report());
  });

  afterAll(async () => {
    await app?.close();
  });

  it("returns the management report for the authenticated tenant", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/admin/reports/management?start=2026-06-01&end=2026-06-30")
      .expect(200);

    expect(managementReportService.getReport).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({
        start: "2026-06-01",
        end: "2026-06-30",
      })
    );
    expect(response.body.period).toEqual({ start: "2026-06-01", end: "2026-06-30" });
  });
});

function report() {
  return {
    period: { start: "2026-06-01", end: "2026-06-30" },
    executiveSummary: {
      grossRevenue: "1000.00",
      netRevenue: "920.00",
      cashNet: "600.00",
      finalBalance: "1600.00",
      payablesOpen: "300.00",
      payablesOverdue: "100.00",
      receivableAmount: "120.00",
      periodNarrative: "Resumo do periodo.",
    },
    cashFlow: {
      credits: "800.00",
      debits: "200.00",
      net: "600.00",
      finalBalance: "1600.00",
      balancesByAccount: [],
    },
    sales: {
      orders: 2,
      grossRevenue: "1000.00",
      netRevenue: "920.00",
      releasedAmount: "800.00",
      receivableAmount: "120.00",
      feeAmount: "80.00",
      averageTicket: "500.00",
      daily: [],
      byInstitution: [],
      byPaymentMethod: [],
      byChannel: [],
    },
    payables: {
      expected: "500.00",
      paid: "200.00",
      open: "300.00",
      overdue: "100.00",
      openCount: 2,
      overdueCount: 1,
      byCategory: [],
    },
  };
}
