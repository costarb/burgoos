import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { OrderStatus, Prisma, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/platform/database/prisma.service";

const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const createdAt = new Date("2026-05-16T10:00:00.000Z");

describe("DRE integration", () => {
  let app: INestApplication;
  let passwordHash: string;

  const prismaMock = {
    user: { findUnique: vi.fn() },
    financialConfiguration: { upsert: vi.fn() },
    orderProfitabilitySnapshot: { findMany: vi.fn() },
    productCostSnapshot: { count: vi.fn() },
    ingredient: { findMany: vi.fn() },
    order: { count: vi.fn() },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    passwordHash = await hash("admin123", 10);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
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
    setupPrismaMock();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("summarizes delivered profitability snapshots and filters cancelled orders", async () => {
    const token = await login();

    const response = await request(app.getHttpServer())
      .get("/api/admin/reports/financial/dre?start=2026-05-01&end=2026-05-31")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(prismaMock.orderProfitabilitySnapshot.findMany).toHaveBeenCalledWith({
      where: {
        tenantId,
        createdAt: {
          gte: new Date("2026-05-01T00:00:00.000Z"),
          lte: new Date("2026-05-31T23:59:59.999Z"),
        },
        order: {
          status: OrderStatus.DELIVERED,
        },
      },
    });
    expect(response.body).toMatchObject({
      grossRevenue: "100.00",
      netRevenue: "100.00",
      cmv: "35.00",
      feesAndTaxes: "21.00",
      grossProfit: "44.00",
      fixedExpenses: "1000.00",
      estimatedNetProfit: "-956.00",
    });
  });

  async function login(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "admin@burgoos.local", password: "admin123" })
      .expect(201);

    return response.body.accessToken as string;
  }

  function setupPrismaMock(): void {
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      tenantId,
      role: UserRole.OWNER,
      name: "Admin Piloto",
      email: "admin@burgoos.local",
      passwordHash,
      tenant: { id: tenantId, active: true },
    });
    prismaMock.financialConfiguration.upsert.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      tenantId,
      monthlyFixedCost: decimal("1000.00"),
      createdAt,
      updatedAt: createdAt,
    });
    prismaMock.orderProfitabilitySnapshot.findMany.mockResolvedValue([
      {
        grossRevenue: decimal("100.00"),
        discount: decimal("0.00"),
        netRevenue: decimal("100.00"),
        cmv: decimal("35.00"),
        platformFee: decimal("12.00"),
        taxAmount: decimal("6.00"),
        paymentFee: decimal("3.00"),
        grossProfit: decimal("44.00"),
      },
    ]);
    prismaMock.productCostSnapshot.count.mockResolvedValue(0);
    prismaMock.ingredient.findMany.mockResolvedValue([]);
    prismaMock.order.count.mockResolvedValue(1);
  }

  function decimal(value: string): Prisma.Decimal {
    return new Prisma.Decimal(value);
  }
});
