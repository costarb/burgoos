import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Prisma, ProductCostStatus, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/platform/database/prisma.service";

const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const platformId = "33333333-3333-4333-8333-333333333333";
const createdAt = new Date("2026-05-15T12:00:00.000Z");

describe("pricing integration", () => {
  let app: INestApplication;
  let passwordHash: string;

  const prismaMock = {
    user: { findUnique: vi.fn() },
    financialConfiguration: { upsert: vi.fn() },
    orderPlatform: { findFirst: vi.fn() },
    product: { findMany: vi.fn() },
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

  it("lists product pricing using the selected platform fees", async () => {
    const token = await login();

    const response = await request(app.getHttpServer())
      .get(`/api/admin/pricing/products?platformId=${platformId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(prismaMock.orderPlatform.findFirst).toHaveBeenCalledWith({
      where: { id: platformId, tenantId, active: true },
    });
    expect(response.body).toEqual([
      {
        productId: "44444444-4444-4444-8444-444444444444",
        productName: "X-Burger",
        currentPrice: "30.00",
        totalCmv: "11.50",
        cmvRate: expect.closeTo(0.3833, 4),
        idealPrice: "23.71",
        estimatedProfit: "12.05",
        estimatedMarginRate: expect.closeTo(0.4017, 4),
        status: ProductCostStatus.REVIEW_PRICE,
      },
      {
        productId: "55555555-5555-4555-8555-555555555555",
        productName: "Batata",
        currentPrice: "18.00",
        totalCmv: "0.00",
        cmvRate: 0,
        idealPrice: "0.00",
        estimatedProfit: "0.00",
        estimatedMarginRate: 0,
        status: ProductCostStatus.MISSING_TECHNICAL_SHEET,
      },
    ]);
  });

  it("rejects pricing analysis for platforms outside the tenant scope", async () => {
    const token = await login();
    prismaMock.orderPlatform.findFirst.mockResolvedValueOnce(null);

    await request(app.getHttpServer())
      .get(`/api/admin/pricing/products?platformId=${platformId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(404);
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
      id: "66666666-6666-4666-8666-666666666666",
      tenantId,
      taxRate: decimal("0.06"),
      cardFeeRate: decimal("0.02"),
      operationalLossRate: decimal("0"),
      desiredMarginRate: decimal("0.30"),
      averagePackagingCost: decimal("2.00"),
      monthlyFixedCost: decimal("0"),
      monthlyRevenueGoal: decimal("0"),
      cmvWarningRate: decimal("0.35"),
      netMarginGoalRate: decimal("0.15"),
      createdAt,
      updatedAt: createdAt,
    });
    prismaMock.orderPlatform.findFirst.mockResolvedValue({
      id: platformId,
      tenantId,
      name: "iFood",
      feeRate: decimal("0.12"),
      paymentFeeRate: decimal("0.035"),
      active: true,
      createdAt,
      updatedAt: createdAt,
    });
    prismaMock.product.findMany.mockResolvedValue([
      {
        id: "44444444-4444-4444-8444-444444444444",
        tenantId,
        name: "X-Burger",
        price: decimal("30.00"),
        technicalSheets: [
          {
            id: "77777777-7777-4777-8777-777777777777",
            tenantId,
            active: true,
            lines: [
              { itemCost: decimal("10.00"), isPackaging: false },
              { itemCost: decimal("1.50"), isPackaging: true },
            ],
          },
        ],
      },
      {
        id: "55555555-5555-4555-8555-555555555555",
        tenantId,
        name: "Batata",
        price: decimal("18.00"),
        technicalSheets: [],
      },
    ]);
  }

  function decimal(value: number | string): Prisma.Decimal {
    return new Prisma.Decimal(value);
  }
});
