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

describe("menu engineering integration", () => {
  let app: INestApplication;
  let passwordHash: string;

  const prismaMock = {
    user: { findUnique: vi.fn() },
    orderProfitabilitySnapshot: { findMany: vi.fn() },
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

  it("returns period product classifications from delivered profitability snapshots", async () => {
    const token = await login();

    const response = await request(app.getHttpServer())
      .get("/api/admin/reports/menu-engineering?dateFrom=2026-05-01&dateTo=2026-05-31")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(prismaMock.orderProfitabilitySnapshot.findMany).toHaveBeenCalledWith({
      where: {
        tenantId,
        createdAt: {
          gte: new Date("2026-05-01T03:00:00.000Z"),
          lte: new Date("2026-06-01T02:59:59.999Z"),
        },
        order: {
          status: OrderStatus.DELIVERED,
        },
      },
      include: {
        orderItem: true,
      },
    });
    expect(response.body).toMatchObject({
      insufficientData: false,
      items: expect.arrayContaining([
        expect.objectContaining({
          productId: "33333333-3333-4333-8333-333333333333",
          productName: "Burger Alto Giro",
          volumeSold: 20,
          classification: "STAR",
        }),
        expect.objectContaining({
          productId: "44444444-4444-4444-8444-444444444444",
          productName: "Burger Baixa Margem",
          volumeSold: 18,
          classification: "WORKHORSE",
        }),
      ]),
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
    prismaMock.orderProfitabilitySnapshot.findMany.mockResolvedValue([
      snapshot(
        "33333333-3333-4333-8333-333333333333",
        "Burger Alto Giro",
        20,
        "1000",
        "300",
        "700"
      ),
      snapshot(
        "44444444-4444-4444-8444-444444444444",
        "Burger Baixa Margem",
        18,
        "900",
        "540",
        "360"
      ),
      snapshot("55555555-5555-4555-8555-555555555555", "Burger Boa Margem", 3, "180", "45", "135"),
      snapshot("66666666-6666-4666-8666-666666666666", "Burger Fraco", 2, "100", "80", "20"),
    ]);
  }

  function snapshot(
    productId: string,
    productName: string,
    quantity: number,
    netRevenue: string,
    cmv: string,
    grossProfit: string
  ) {
    return {
      netRevenue: decimal(netRevenue),
      cmv: decimal(cmv),
      grossProfit: decimal(grossProfit),
      orderItem: {
        productId,
        productNameSnapshot: productName,
        quantity,
      },
    };
  }

  function decimal(value: string): Prisma.Decimal {
    return new Prisma.Decimal(value);
  }
});
