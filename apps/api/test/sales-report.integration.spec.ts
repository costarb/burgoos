import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { OrderStatus, PaymentInstitution, PaymentMethod, Prisma, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/platform/database/prisma.service";

const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const platformId = "33333333-3333-4333-8333-333333333333";

describe("sales report integration", () => {
  let app: INestApplication;
  let passwordHash: string;

  const prismaMock = {
    user: { findUnique: vi.fn() },
    order: { findMany: vi.fn(), count: vi.fn() },
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

  it("returns sales report grouped by local period and scoped filters", async () => {
    const token = await login();

    const response = await request(app.getHttpServer())
      .get(
        `/api/admin/reports/sales?start=2026-05-30&end=2026-06-01&paymentInstitution=MERCADO_PAGO&paymentMethod=CREDIT_CARD&orderPlatformId=${platformId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(prismaMock.order.findMany).toHaveBeenCalledWith({
      where: {
        tenantId,
        createdAt: {
          gte: new Date("2026-05-30T03:00:00.000Z"),
          lte: new Date("2026-06-02T02:59:59.999Z"),
        },
        status: OrderStatus.DELIVERED,
        paymentInstitution: PaymentInstitution.MERCADO_PAGO,
        paymentMethod: PaymentMethod.CREDIT_CARD,
        orderPlatformId: platformId,
      },
      include: {
        items: true,
        orderPlatform: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
    expect(prismaMock.order.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ tenantId, orderPlatformId: platformId }),
    });
    expect(response.body).toMatchObject({
      summary: {
        orderCount: 1,
        grossRevenue: "46.00",
        acquiredNetRevenue: "45.66",
        releasedNetRevenue: "0.00",
        receivableNetAmount: "45.66",
        paymentFeeAmount: "0.34",
      },
      analytical: {
        total: 1,
        items: [
          expect.objectContaining({
            externalPaymentId: "161753244614",
            grossAmount: "46.00",
            acquiredNetAmount: "45.66",
            paymentReleaseStatus: "PENDING_RELEASE",
            imported: true,
          }),
        ],
      },
    });
    expect(response.body.daily).toHaveLength(3);
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
    prismaMock.order.findMany.mockResolvedValue([
      {
        id: "44444444-4444-4444-8444-444444444444",
        tenantId,
        status: OrderStatus.DELIVERED,
        total: decimal("46.00"),
        customerName: "Cliente importado",
        customerPhone: "11999999999",
        fulfillmentMethod: "PICKUP",
        deliveryAddress: null,
        paymentMethod: PaymentMethod.CREDIT_CARD,
        paymentInstitution: PaymentInstitution.MERCADO_PAGO,
        externalPaymentId: "161753244614",
        paymentGrossAmount: decimal("46.00"),
        paymentFeeAmount: decimal("0.34"),
        paymentNetAmount: decimal("45.66"),
        paymentBrand: "Visa",
        paymentReleaseExpectedAt: new Date("2026-06-29T21:00:00.000Z"),
        paymentReleaseSource: "EXTRACT",
        orderPlatformId: platformId,
        notes: null,
        createdAt: new Date("2026-05-30T21:00:00.000Z"),
        updatedAt: new Date("2026-05-30T21:00:00.000Z"),
        orderPlatform: {
          id: platformId,
          tenantId,
          name: "FOOD_TRUCK",
          feeRate: decimal("0.0000"),
          paymentFeeRate: decimal("0.0000"),
          active: true,
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z"),
        },
        items: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            tenantId,
            orderId: "44444444-4444-4444-8444-444444444444",
            productId: "66666666-6666-4666-8666-666666666666",
            productNameSnapshot: "X-BURGUER",
            quantity: 1,
            unitPrice: decimal("46.00"),
            total: decimal("46.00"),
          },
        ],
      },
    ]);
    prismaMock.order.count.mockResolvedValue(1);
  }

  function decimal(value: string): Prisma.Decimal {
    return new Prisma.Decimal(value);
  }
});
