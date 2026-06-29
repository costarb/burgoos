import { CanActivate, ExecutionContext, INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Prisma, UserRole } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PermissionGuard } from "../src/auth/guards/permission.guard";
import { AccountsPayableController } from "../src/management/financial/accounts-payable/accounts-payable.controller";
import { AccountsPayableService } from "../src/management/financial/accounts-payable/accounts-payable.service";
import { FinancialAuditService } from "../src/management/financial/financial-audit.service";
import { AuthenticatedRequest } from "../src/platform/auth/auth.types";
import { FinancialManagementRolesGuard } from "../src/platform/auth/roles.guard";
import { JwtAuthGuard } from "../src/platform/auth/jwt-auth.guard";
import { PrismaService } from "../src/platform/database/prisma.service";

const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const categoryId = "33333333-3333-4333-8333-333333333333";
const supplierId = "44444444-4444-4444-8444-444444444444";

class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.user = {
      id: userId,
      tenantId,
      role: UserRole.OWNER,
      email: "admin@burgoos.local",
      name: "Admin Piloto",
      isMaster: false,
      activeStoreId: tenantId,
      allowedStoreIds: [tenantId],
      manageableStoreIds: [],
      permissions: ["finance.view", "finance.manage"],
    };
    return true;
  }
}

describe("accounts payable filters integration", () => {
  let app: INestApplication;

  const prismaMock = {
    payable: {
      findMany: vi.fn(),
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AccountsPayableController],
      providers: [
        AccountsPayableService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: FinancialAuditService,
          useValue: { record: vi.fn() },
        },
      ],
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

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.payable.findMany.mockResolvedValue([payable()]);
  });

  afterAll(async () => {
    await app?.close();
  });

  it("rejects invalid competenceMonth query values", async () => {
    await request(app.getHttpServer())
      .get("/api/admin/financial/payables?competenceMonth=2026-6")
      .expect(400);
  });

  it("combines category, supplier, competence month, due period and status filters", async () => {
    const response = await request(app.getHttpServer())
      .get(
        `/api/admin/financial/payables?categoryId=${categoryId}&supplierId=${supplierId}&competenceMonth=2026-06&start=2026-06-01&end=2026-06-30&status=OPEN`
      )
      .expect(200);

    expect(prismaMock.payable.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId,
          categoryId,
          supplierId,
          competenceDate: {
            gte: new Date(2026, 5, 1),
            lt: new Date(2026, 6, 1),
          },
          dueDate: {
            gte: new Date(2026, 5, 1),
            lte: new Date(2026, 5, 30, 23, 59, 59, 999),
          },
        }),
      })
    );
    expect(response.body.items).toEqual([
      expect.objectContaining({
        id: "payable-1",
        categoryId,
        supplierId,
        competenceDate: "2026-06-10",
        status: "OPEN",
      }),
    ]);
    expect(response.body.summary.totalExpected).toBe("120.00");
  });
});

function payable() {
  return {
    id: "payable-1",
    tenantId,
    categoryId,
    supplierId,
    recurrenceGroupId: null,
    description: "Compra de insumos",
    documentReference: null,
    competenceDate: new Date(2026, 5, 10),
    dueDate: new Date(2026, 5, 30),
    expectedAmount: new Prisma.Decimal(120),
    notes: null,
    cancelledAt: null,
    cancellationReason: null,
    createdByUserId: userId,
    createdAt: new Date(2026, 5, 1),
    updatedAt: new Date(2026, 5, 1),
    category: {
      id: categoryId,
      name: "Insumos",
    },
    supplier: {
      id: supplierId,
      name: "Fornecedor Piloto",
    },
    payments: [],
  };
}
