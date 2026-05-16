import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { FulfillmentMethod, OrderStatus, PaymentMethod, Prisma, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/platform/database/prisma.service";

interface TenantRecord {
  id: string;
  name: string;
  slug: string;
  phone: string;
  active: boolean;
  isOpen: boolean;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface UserRecord {
  id: string;
  tenantId: string;
  role: UserRole;
  name: string;
  email: string;
  passwordHash: string;
  tenant: TenantRecord;
}

interface CategoryRecord {
  id: string;
  tenantId: string;
  name: string;
  sortOrder: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ProductRecord {
  id: string;
  tenantId: string;
  categoryId: string;
  name: string;
  description: string;
  price: Prisma.Decimal;
  imageUrl: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface OrderItemRecord {
  id: string;
  tenantId: string;
  orderId: string;
  productId: string;
  productNameSnapshot: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  total: Prisma.Decimal;
}

interface OrderRecord {
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
  items: OrderItemRecord[];
}

const tenantId = "11111111-1111-4111-8111-111111111111";
const closedTenantId = "22222222-2222-4222-8222-222222222222";
const createdAt = new Date("2026-05-14T10:00:00.000Z");

describe("pilot hardening e2e", () => {
  let app: INestApplication;
  let passwordHash: string;
  let tenants: TenantRecord[];
  let users: UserRecord[];
  let categories: CategoryRecord[];
  let products: ProductRecord[];
  let orders: OrderRecord[];

  const prismaMock = {
    user: {
      findUnique: vi.fn(),
    },
    tenant: {
      findFirst: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    ingredient: {
      findMany: vi.fn(),
    },
    technicalSheet: {
      findMany: vi.fn(),
    },
    stockMovement: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    order: {
      create: vi.fn(),
      findMany: vi.fn(),
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

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
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

    tenants = [
      {
        id: tenantId,
        name: "Loja Piloto",
        slug: "piloto",
        phone: "5500000000000",
        active: true,
        isOpen: true,
        config: {},
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: closedTenantId,
        name: "Loja Fechada",
        slug: "fechada",
        phone: "5500000000001",
        active: true,
        isOpen: false,
        config: {},
        createdAt,
        updatedAt: createdAt,
      },
    ];
    users = [
      {
        id: "33333333-3333-4333-8333-333333333333",
        tenantId,
        role: UserRole.OWNER,
        name: "Admin Piloto",
        email: "admin@burgoos.local",
        passwordHash,
        tenant: tenants[0] as TenantRecord,
      },
    ];
    categories = [];
    products = [];
    orders = [];
    setupPrismaMock();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("creates catalog, exposes the menu, places an order and manages it to delivered", async () => {
    const token = await login();

    const burgers = await request(app.getHttpServer())
      .post("/api/admin/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Burgers", sortOrder: 1 })
      .expect(201);

    const sides = await request(app.getHttpServer())
      .post("/api/admin/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Acompanhamentos", sortOrder: 2 })
      .expect(201);

    const burger = await request(app.getHttpServer())
      .post("/api/admin/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        categoryId: burgers.body.id,
        name: "Burgo Classico",
        description: "Pao, burger e queijo",
        price: 29.9,
        imageUrl: "https://example.com/classico.jpg",
      })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/admin/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        categoryId: sides.body.id,
        name: "Batata",
        description: "Porcao individual",
        price: 12,
      })
      .expect(201);

    const menu = await request(app.getHttpServer())
      .get("/api/public/tenants/piloto/menu")
      .expect(200);

    expect(menu.body.categories).toHaveLength(2);
    expect(menu.body.categories[0]).toMatchObject({
      name: "Burgers",
      products: [
        {
          name: "Burgo Classico",
          price: "29.90",
        },
      ],
    });

    const order = await request(app.getHttpServer())
      .post("/api/public/tenants/piloto/orders")
      .send({
        customerName: "Cliente Piloto",
        customerPhone: "11999999999",
        fulfillmentMethod: "DELIVERY",
        paymentMethod: "PIX_MANUAL",
        deliveryAddress: {
          address: "Rua Piloto, 123",
        },
        items: [
          {
            productId: burger.body.id,
            quantity: 2,
          },
        ],
      })
      .expect(201);

    expect(order.body).toMatchObject({
      status: "PENDING",
      total: "59.80",
      customerName: "Cliente Piloto",
    });
    expect(decodeURIComponent(order.body.whatsappUrl as string)).toContain("Total: R$ 59.80");

    const queue = await request(app.getHttpServer())
      .get("/api/admin/orders")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(queue.body).toHaveLength(1);
    expect(queue.body[0]).toMatchObject({
      id: order.body.id,
      status: "PENDING",
    });

    for (const status of ["PREPARING", "SHIPPED", "DELIVERED"]) {
      await request(app.getHttpServer())
        .patch(`/api/admin/orders/${order.body.id}/status`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status })
        .expect(200);
    }

    const activeQueue = await request(app.getHttpServer())
      .get("/api/admin/orders")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const history = await request(app.getHttpServer())
      .get("/api/admin/orders?history=true")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(activeQueue.body).toHaveLength(0);
    expect(history.body).toHaveLength(1);
    expect(history.body[0]).toMatchObject({
      id: order.body.id,
      status: "DELIVERED",
    });
  });

  it("blocks checkout when the public store is closed", async () => {
    const token = await login();
    const category = await createCategory(token, "Burgers");
    const product = await createProduct(token, category.body.id, "Burgo Classico", 29.9);
    const closedProduct = {
      ...products[0],
      id: product.body.id,
      tenantId: closedTenantId,
      categoryId: category.body.id,
    } as ProductRecord;

    products.push(closedProduct);

    await request(app.getHttpServer())
      .post("/api/public/tenants/fechada/orders")
      .send({
        customerName: "Cliente Piloto",
        customerPhone: "11999999999",
        fulfillmentMethod: "PICKUP",
        paymentMethod: "CASH",
        items: [
          {
            productId: closedProduct.id,
            quantity: 1,
          },
        ],
      })
      .expect(409);

    expect(orders).toHaveLength(0);
  });

  it("hides inactive products from the public menu and rejects stale carts", async () => {
    const token = await login();
    const category = await createCategory(token, "Burgers");
    const activeProduct = await createProduct(token, category.body.id, "Burgo Classico", 29.9);
    const inactiveProduct = await createProduct(token, category.body.id, "Burgo Oculto", 10);

    await request(app.getHttpServer())
      .patch(`/api/admin/products/${inactiveProduct.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ active: false })
      .expect(200);

    const menu = await request(app.getHttpServer())
      .get("/api/public/tenants/piloto/menu")
      .expect(200);

    expect(JSON.stringify(menu.body)).toContain(activeProduct.body.id);
    expect(JSON.stringify(menu.body)).not.toContain(inactiveProduct.body.id);

    await request(app.getHttpServer())
      .post("/api/public/tenants/piloto/orders")
      .send({
        customerName: "Cliente Piloto",
        customerPhone: "11999999999",
        fulfillmentMethod: "PICKUP",
        paymentMethod: "CARD_ON_DELIVERY",
        items: [
          {
            productId: inactiveProduct.body.id,
            quantity: 1,
          },
        ],
      })
      .expect(409);

    expect(orders).toHaveLength(0);
  });

  async function login(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "admin@burgoos.local", password: "admin123" })
      .expect(201);

    return response.body.accessToken as string;
  }

  function createCategory(token: string, name: string) {
    return request(app.getHttpServer())
      .post("/api/admin/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name })
      .expect(201);
  }

  function createProduct(token: string, categoryId: string, name: string, price: number) {
    return request(app.getHttpServer())
      .post("/api/admin/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        categoryId,
        name,
        description: `${name} description`,
        price,
      })
      .expect(201);
  }

  function setupPrismaMock(): void {
    prismaMock.user.findUnique.mockImplementation(({ where }: { where: { email: string } }) => {
      return users.find((user) => user.email === where.email) ?? null;
    });

    prismaMock.tenant.findFirst.mockImplementation(
      ({ where }: { where: { id?: string; slug?: string; active?: boolean } }) =>
        tenants.find((tenant) => {
          if (where.id && tenant.id !== where.id) {
            return false;
          }

          if (where.slug && tenant.slug !== where.slug) {
            return false;
          }

          if (typeof where.active === "boolean" && tenant.active !== where.active) {
            return false;
          }

          return true;
        }) ?? null
    );

    prismaMock.category.findMany.mockImplementation(
      ({ where }: { where: { tenantId: string; active?: boolean; products?: unknown } }) => {
        const tenantCategories = categories
          .filter((category) => category.tenantId === where.tenantId)
          .filter((category) =>
            typeof where.active === "boolean" ? category.active === where.active : true
          )
          .sort(
            (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
          );

        if (where.products) {
          return tenantCategories
            .filter((category) =>
              products.some(
                (product) =>
                  product.tenantId === category.tenantId &&
                  product.categoryId === category.id &&
                  product.active
              )
            )
            .map((category) => ({
              id: category.id,
              name: category.name,
              products: products
                .filter(
                  (product) =>
                    product.tenantId === category.tenantId &&
                    product.categoryId === category.id &&
                    product.active
                )
                .sort((left, right) => left.name.localeCompare(right.name))
                .map((product) => ({
                  id: product.id,
                  name: product.name,
                  description: product.description,
                  price: product.price,
                  imageUrl: product.imageUrl,
                })),
            }));
        }

        return tenantCategories;
      }
    );

    prismaMock.category.findFirst.mockImplementation(
      ({ where }: { where: { id: string; tenantId: string } }) =>
        categories.find(
          (category) => category.id === where.id && category.tenantId === where.tenantId
        ) ?? null
    );

    prismaMock.category.create.mockImplementation(
      ({
        data,
      }: {
        data: {
          tenantId: string;
          name: string;
          sortOrder?: number;
          active?: boolean;
        };
      }) => {
        const category: CategoryRecord = {
          id: `44444444-4444-4444-8444-${String(categories.length + 1).padStart(12, "0")}`,
          tenantId: data.tenantId,
          name: data.name,
          sortOrder: data.sortOrder ?? 0,
          active: data.active ?? true,
          createdAt,
          updatedAt: createdAt,
        };
        categories.push(category);
        return category;
      }
    );

    prismaMock.category.update.mockImplementation(
      ({ where, data }: { where: { id: string }; data: Partial<CategoryRecord> }) => {
        const category = categories.find((candidate) => candidate.id === where.id);

        if (!category) {
          return null;
        }

        Object.assign(category, data, { updatedAt: createdAt });
        return category;
      }
    );

    prismaMock.product.findMany.mockImplementation(
      ({
        where,
      }: {
        where: {
          tenantId: string;
          active?: boolean;
          id?: { in: string[] };
          category?: { active: boolean };
        };
      }) =>
        products.filter((product) => {
          if (product.tenantId !== where.tenantId) {
            return false;
          }

          if (where.id?.in && !where.id.in.includes(product.id)) {
            return false;
          }

          if (typeof where.active === "boolean" && product.active !== where.active) {
            return false;
          }

          if (where.category?.active) {
            const category = categories.find((candidate) => candidate.id === product.categoryId);

            if (!category?.active) {
              return false;
            }
          }

          return true;
        })
    );

    prismaMock.product.findFirst.mockImplementation(
      ({ where }: { where: { id: string; tenantId: string } }) =>
        products.find(
          (product) => product.id === where.id && product.tenantId === where.tenantId
        ) ?? null
    );
    prismaMock.ingredient.findMany.mockResolvedValue([]);
    prismaMock.technicalSheet.findMany.mockResolvedValue([]);
    prismaMock.stockMovement.findMany.mockResolvedValue([]);
    prismaMock.stockMovement.createMany.mockImplementation(({ data }: { data: unknown[] }) => ({
      count: data.length,
    }));

    prismaMock.product.create.mockImplementation(
      ({
        data,
      }: {
        data: {
          tenantId: string;
          categoryId: string;
          name: string;
          description?: string;
          price: Prisma.Decimal;
          imageUrl?: string | null;
          active?: boolean;
        };
      }) => {
        const product: ProductRecord = {
          id: `55555555-5555-4555-8555-${String(products.length + 1).padStart(12, "0")}`,
          tenantId: data.tenantId,
          categoryId: data.categoryId,
          name: data.name,
          description: data.description ?? "",
          price: data.price,
          imageUrl: data.imageUrl ?? null,
          active: data.active ?? true,
          createdAt,
          updatedAt: createdAt,
        };
        products.push(product);
        return product;
      }
    );

    prismaMock.product.update.mockImplementation(
      ({ where, data }: { where: { id: string }; data: Partial<ProductRecord> }) => {
        const product = products.find((candidate) => candidate.id === where.id);

        if (!product) {
          return null;
        }

        Object.assign(product, data, { updatedAt: createdAt });
        return product;
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
        const order: OrderRecord = {
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

    prismaMock.order.findMany.mockImplementation(
      ({
        where,
      }: {
        where: {
          tenantId: string;
          status: {
            in?: OrderStatus[];
            notIn?: OrderStatus[];
          };
        };
      }) =>
        orders.filter((order) => {
          if (order.tenantId !== where.tenantId) {
            return false;
          }

          if (where.status.in && !where.status.in.includes(order.status)) {
            return false;
          }

          if (where.status.notIn && where.status.notIn.includes(order.status)) {
            return false;
          }

          return true;
        })
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
        order.updatedAt = createdAt;
        return order;
      }
    );
  }
});
