import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  FulfillmentMethod,
  OrderStatus,
  PaymentMethod,
  Prisma,
  StockMovementType,
  UserRole,
} from "@prisma/client";
import { hash } from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/platform/database/prisma.service";

const tenantId = "11111111-1111-4111-8111-111111111111";
const productId = "22222222-2222-4222-8222-222222222222";
const ingredientId = "33333333-3333-4333-8333-333333333333";
const createdAt = new Date("2026-05-16T10:30:00.000Z");

describe("profitability flow e2e", () => {
  let app: INestApplication;
  let passwordHash: string;
  let orders: Array<{
    id: string;
    tenantId: string;
    status: OrderStatus;
    total: Prisma.Decimal;
    customerName: string;
    customerPhone: string;
    fulfillmentMethod: FulfillmentMethod;
    deliveryAddress: Prisma.JsonValue | null;
    paymentMethod: PaymentMethod;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    items: Array<{
      id: string;
      tenantId: string;
      orderId: string;
      productId: string;
      productNameSnapshot: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
      total: Prisma.Decimal;
    }>;
  }>;
  let stockMovements: Array<{
    id: string;
    tenantId: string;
    ingredientId: string;
    orderId: string | null;
    orderItemId: string | null;
    movementType: StockMovementType;
    quantity: Prisma.Decimal;
    reason: string | null;
    createdAt: Date;
  }>;

  const prismaMock = {
    user: { findUnique: vi.fn() },
    tenant: { findFirst: vi.fn() },
    product: { findMany: vi.fn() },
    ingredient: { findMany: vi.fn() },
    financialConfiguration: { upsert: vi.fn() },
    orderProfitabilitySnapshot: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    technicalSheet: { findMany: vi.fn() },
    stockMovement: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    order: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
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
    orders = [];
    stockMovements = [];
    setupPrismaMock();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("reserves, releases and consumes stock through the order lifecycle", async () => {
    const token = await login();
    const cancelledOrder = await createOrder();

    await expectBlendBalance(token, {
      reservedOrConsumed: 360,
      estimatedBalance: 640,
    });

    await request(app.getHttpServer())
      .patch(`/api/admin/orders/${cancelledOrder.body.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "CANCELLED" })
      .expect(200);
    await expectBlendBalance(token, {
      reservedOrConsumed: 0,
      estimatedBalance: 1000,
    });

    const deliveredOrder = await createOrder();
    await request(app.getHttpServer())
      .patch(`/api/admin/orders/${deliveredOrder.body.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "PREPARING" })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/admin/orders/${deliveredOrder.body.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "DELIVERED" })
      .expect(200);

    await expectBlendBalance(token, {
      reservedOrConsumed: 360,
      estimatedBalance: 640,
    });
  });

  async function login(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "admin@burgoos.local", password: "admin123" })
      .expect(201);

    return response.body.accessToken as string;
  }

  function createOrder() {
    return request(app.getHttpServer())
      .post("/api/public/tenants/piloto/orders")
      .send({
        customerName: "Cliente Piloto",
        customerPhone: "11999999999",
        fulfillmentMethod: "PICKUP",
        paymentMethod: "PIX_MANUAL",
        items: [{ productId, quantity: 2 }],
      })
      .expect(201);
  }

  async function expectBlendBalance(
    token: string,
    expected: { reservedOrConsumed: number; estimatedBalance: number }
  ): Promise<void> {
    const response = await request(app.getHttpServer())
      .get("/api/admin/inventory/balances")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({
        ingredientId,
        reservedOrConsumed: expected.reservedOrConsumed,
        estimatedBalance: expected.estimatedBalance,
      }),
    ]);
  }

  function setupPrismaMock(): void {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
      tenantId,
      role: UserRole.OWNER,
      name: "Admin Piloto",
      email: "admin@burgoos.local",
      passwordHash,
      tenant: { id: tenantId, active: true },
    });
    prismaMock.tenant.findFirst.mockResolvedValue({
      id: tenantId,
      name: "Loja Piloto",
      slug: "piloto",
      phone: "5500000000000",
      active: true,
      isOpen: true,
    });
    prismaMock.product.findMany.mockResolvedValue([
      { id: productId, name: "Magnifico Burger", price: decimal("30.99") },
    ]);
    prismaMock.financialConfiguration.upsert.mockResolvedValue({
      id: "88888888-8888-4888-8888-888888888888",
      tenantId,
      taxRate: decimal("0.06"),
      cardFeeRate: decimal("0.02"),
      operationalLossRate: decimal("0.00"),
      monthlyFixedCost: decimal("0"),
      createdAt,
      updatedAt: createdAt,
    });
    prismaMock.orderProfitabilitySnapshot.findMany.mockResolvedValue([]);
    prismaMock.orderProfitabilitySnapshot.createMany.mockImplementation(
      ({ data }: { data: unknown[] }) => ({ count: data.length })
    );
    prismaMock.technicalSheet.findMany.mockResolvedValue([
      {
        productId,
        lines: [{ ingredientId, quantityUsed: decimal("180"), itemCost: decimal("4.50") }],
      },
    ]);
    prismaMock.ingredient.findMany.mockImplementation(() => [
      {
        id: ingredientId,
        tenantId,
        name: "Blend",
        currentStock: decimal("1000"),
        minimumStock: decimal("100"),
        stockMovements,
      },
    ]);
    prismaMock.stockMovement.findMany.mockImplementation(
      ({
        where,
      }: {
        where: { tenantId: string; orderId?: string; movementType?: StockMovementType };
      }) =>
        stockMovements.filter((movement) => {
          if (movement.tenantId !== where.tenantId) {
            return false;
          }

          if (where.orderId && movement.orderId !== where.orderId) {
            return false;
          }

          if (where.movementType && movement.movementType !== where.movementType) {
            return false;
          }

          return true;
        })
    );
    prismaMock.stockMovement.createMany.mockImplementation(
      ({
        data,
      }: {
        data: Array<{
          tenantId: string;
          ingredientId: string;
          orderId?: string;
          orderItemId?: string;
          movementType: StockMovementType;
          quantity: Prisma.Decimal;
          reason: string;
        }>;
      }) => {
        data.forEach((movement) => {
          stockMovements.push({
            id: `55555555-5555-4555-8555-${String(stockMovements.length + 1).padStart(12, "0")}`,
            tenantId: movement.tenantId,
            ingredientId: movement.ingredientId,
            orderId: movement.orderId ?? null,
            orderItemId: movement.orderItemId ?? null,
            movementType: movement.movementType,
            quantity: movement.quantity,
            reason: movement.reason,
            createdAt,
          });
        });
        return { count: data.length };
      }
    );
    prismaMock.order.create.mockImplementation(
      ({
        data,
      }: {
        data: {
          tenantId: string;
          total: Prisma.Decimal;
          customerName: string;
          customerPhone: string;
          fulfillmentMethod: FulfillmentMethod;
          deliveryAddress?: Prisma.JsonValue;
          paymentMethod: PaymentMethod;
          notes?: string | null;
          items: {
            create: Array<{
              tenantId: string;
              productId: string;
              productNameSnapshot: string;
              quantity: number;
              unitPrice: Prisma.Decimal;
              total: Prisma.Decimal;
            }>;
          };
        };
      }) => {
        const orderId = `66666666-6666-4666-8666-${String(orders.length + 1).padStart(12, "0")}`;
        const order = {
          id: orderId,
          tenantId: data.tenantId,
          status: OrderStatus.PENDING,
          total: data.total,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          fulfillmentMethod: data.fulfillmentMethod,
          deliveryAddress: data.deliveryAddress ?? null,
          paymentMethod: data.paymentMethod,
          notes: data.notes ?? null,
          createdAt,
          updatedAt: createdAt,
          items: data.items.create.map((item, index) => ({
            id: `77777777-7777-4777-8777-${String(index + 1).padStart(12, "0")}`,
            tenantId: item.tenantId,
            orderId,
            productId: item.productId,
            productNameSnapshot: item.productNameSnapshot,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
          })),
        };
        orders.push(order);
        return order;
      }
    );
    prismaMock.order.findFirst.mockImplementation(
      ({ where }: { where: { id: string; tenantId: string } }) =>
        orders.find((order) => order.id === where.id && order.tenantId === where.tenantId) ?? null
    );
    prismaMock.order.update.mockImplementation(
      ({ where, data }: { where: { id: string }; data: { status: OrderStatus } }) => {
        const order = orders.find((candidate) => candidate.id === where.id);

        if (!order) {
          return null;
        }

        order.status = data.status;
        return order;
      }
    );
  }

  function decimal(value: number | string): Prisma.Decimal {
    return new Prisma.Decimal(value);
  }
});
