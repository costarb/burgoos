import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hash } from "bcryptjs";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/platform/database/prisma.service";

describe("platform foundation", () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const activeTenant = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Loja Piloto",
    slug: "piloto",
    phone: "5500000000000",
    active: true,
    isOpen: true
  };

  const inactiveTenant = {
    id: "77777777-7777-4777-8777-777777777777",
    name: "Loja Inativa",
    slug: "inativa",
    phone: "5500000000001",
    active: false,
    isOpen: false
  };

  const closedTenant = {
    id: "88888888-8888-4888-8888-888888888888",
    name: "Loja Fechada",
    slug: "fechada",
    phone: "5500000000002",
    active: true,
    isOpen: false
  };

  const categories = [
    {
      id: "22222222-2222-4222-8222-222222222222",
      tenantId: activeTenant.id,
      name: "Hambúrgueres",
      sortOrder: 0,
      active: true,
      createdAt: new Date("2026-05-13T00:00:00.000Z"),
      updatedAt: new Date("2026-05-13T00:00:00.000Z")
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      tenantId: activeTenant.id,
      name: "Ocultos",
      sortOrder: 1,
      active: false,
      createdAt: new Date("2026-05-13T00:00:00.000Z"),
      updatedAt: new Date("2026-05-13T00:00:00.000Z")
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      tenantId: "99999999-9999-4999-8999-999999999999",
      name: "Outro Tenant",
      sortOrder: 0,
      active: true,
      createdAt: new Date("2026-05-13T00:00:00.000Z"),
      updatedAt: new Date("2026-05-13T00:00:00.000Z")
    }
  ];

  const products = [
    {
      id: "55555555-5555-4555-8555-555555555555",
      tenantId: activeTenant.id,
      categoryId: "22222222-2222-4222-8222-222222222222",
      name: "Burgo Clássico",
      description: "Pão, burger e queijo",
      price: new Prisma.Decimal("29.90"),
      imageUrl: "https://example.com/burgo.jpg",
      active: true,
      createdAt: new Date("2026-05-13T00:00:00.000Z"),
      updatedAt: new Date("2026-05-13T00:00:00.000Z")
    },
    {
      id: "66666666-6666-4666-8666-666666666666",
      tenantId: activeTenant.id,
      categoryId: "22222222-2222-4222-8222-222222222222",
      name: "Produto Oculto",
      description: "Não deve aparecer",
      price: new Prisma.Decimal("10.00"),
      imageUrl: null,
      active: false,
      createdAt: new Date("2026-05-13T00:00:00.000Z"),
      updatedAt: new Date("2026-05-13T00:00:00.000Z")
    }
  ];

  const orders = [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tenantId: activeTenant.id,
      status: "PENDING",
      total: new Prisma.Decimal("59.80"),
      customerName: "Cliente Teste",
      customerPhone: "11999999999",
      fulfillmentMethod: "DELIVERY",
      paymentMethod: "PIX_MANUAL",
      notes: null,
      createdAt: new Date("2026-05-13T01:00:00.000Z"),
      items: [
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb0",
          productId: "55555555-5555-4555-8555-555555555555",
          productNameSnapshot: "Burgo ClÃ¡ssico",
          quantity: 2,
          unitPrice: new Prisma.Decimal("29.90"),
          total: new Prisma.Decimal("59.80")
        }
      ]
    },
    {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      tenantId: activeTenant.id,
      status: "DELIVERED",
      total: new Prisma.Decimal("29.90"),
      customerName: "Cliente Historico",
      customerPhone: "11888888888",
      fulfillmentMethod: "PICKUP",
      paymentMethod: "CASH",
      notes: null,
      createdAt: new Date("2026-05-13T02:00:00.000Z"),
      items: []
    },
    {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      tenantId: "99999999-9999-4999-8999-999999999999",
      status: "PENDING",
      total: new Prisma.Decimal("10.00"),
      customerName: "Outro Tenant",
      customerPhone: "11777777777",
      fulfillmentMethod: "PICKUP",
      paymentMethod: "CASH",
      notes: null,
      createdAt: new Date("2026-05-13T03:00:00.000Z"),
      items: []
    }
  ];

  const prismaMock = {
    user: {
      findUnique: vi.fn()
    },
    tenant: {
      findFirst: vi.fn()
    },
    category: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    product: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    ingredient: {
      findMany: vi.fn()
    },
    technicalSheet: {
      findMany: vi.fn()
    },
    stockMovement: {
      findMany: vi.fn(),
      createMany: vi.fn()
    },
    order: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn()
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  };

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

    const passwordHash = await hash("admin123", 10);

    prismaMock.user.findUnique.mockImplementation(({ where }: { where: { email: string } }) => {
      if (where.email !== "admin@burgoos.local") {
        return null;
      }

      return {
        id: "user-owner",
        tenantId: activeTenant.id,
        role: "OWNER",
        name: "Admin Piloto",
        email: "admin@burgoos.local",
        passwordHash,
        tenant: activeTenant
      };
    });

    prismaMock.tenant.findFirst.mockImplementation(
      ({ where }: { where: { id?: string; slug?: string; active?: boolean } }) => {
        const tenants = [activeTenant, inactiveTenant, closedTenant];
        const tenant = tenants.find((candidate) => {
          if (where.id && candidate.id !== where.id) {
            return false;
          }

          if (where.slug && candidate.slug !== where.slug) {
            return false;
          }

          if (typeof where.active === "boolean" && candidate.active !== where.active) {
            return false;
          }

          return true;
        });

        return tenant ?? null;
      }
    );

    prismaMock.category.findMany.mockImplementation(({ where }: { where: Record<string, unknown> }) => {
      if (where.active === true && typeof where.products === "object") {
        return categories
          .filter((category) => category.tenantId === where.tenantId && category.active)
          .filter((category) =>
            products.some(
              (product) =>
                product.categoryId === category.id &&
                product.tenantId === category.tenantId &&
                product.active
            )
          )
          .map((category) => ({
            id: category.id,
            name: category.name,
            products: products
              .filter((product) => product.categoryId === category.id && product.active)
              .map(({ id, name, description, price, imageUrl }) => ({
                id,
                name,
                description,
                price,
                imageUrl
              }))
          }));
      }

      return categories.filter((category) => category.tenantId === where.tenantId);
    });

    prismaMock.category.findFirst.mockImplementation(
      ({ where }: { where: { id: string; tenantId: string } }) =>
        categories.find(
          (category) => category.id === where.id && category.tenantId === where.tenantId
        ) ?? null
    );

    prismaMock.category.create.mockImplementation(({ data }: { data: (typeof categories)[number] }) => ({
      ...data,
      id: "category-created",
      createdAt: new Date("2026-05-13T00:00:00.000Z"),
      updatedAt: new Date("2026-05-13T00:00:00.000Z")
    }));

    prismaMock.category.update.mockImplementation(
      ({ where, data }: { where: { id: string }; data: Partial<(typeof categories)[number]> }) => ({
        ...categories.find((category) => category.id === where.id),
        ...data
      })
    );

    prismaMock.product.findMany.mockImplementation(
      ({
        where
      }: {
        where: {
          tenantId: string;
          active?: boolean;
          id?: { in: string[] };
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

          return true;
        })
    );

    prismaMock.product.findFirst.mockImplementation(
      ({ where }: { where: { id: string; tenantId: string } }) =>
        products.find((product) => product.id === where.id && product.tenantId === where.tenantId) ??
        null
    );

    prismaMock.product.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: "product-created",
      createdAt: new Date("2026-05-13T00:00:00.000Z"),
      updatedAt: new Date("2026-05-13T00:00:00.000Z"),
      ...data
    }));

    prismaMock.product.update.mockImplementation(
      ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
        ...products.find((product) => product.id === where.id),
        ...data
      })
    );
    prismaMock.ingredient.findMany.mockResolvedValue([]);
    prismaMock.technicalSheet.findMany.mockResolvedValue([]);
    prismaMock.stockMovement.findMany.mockResolvedValue([]);
    prismaMock.stockMovement.createMany.mockImplementation(({ data }: { data: unknown[] }) => ({
      count: data.length
    }));

    prismaMock.order.create.mockImplementation(
      ({
        data
      }: {
        data: {
          tenantId: string;
          total: Prisma.Decimal;
          customerName: string;
          customerPhone: string;
          fulfillmentMethod: string;
          paymentMethod: string;
          notes?: string | null;
          items: {
            create: Array<Record<string, unknown>>;
          };
        };
      }) => ({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        tenantId: data.tenantId,
        status: "PENDING",
        total: data.total,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        fulfillmentMethod: data.fulfillmentMethod,
        paymentMethod: data.paymentMethod,
        notes: data.notes ?? null,
        items: data.items.create.map((item: Record<string, unknown>, index: number) => ({
          id: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb${index}`,
          ...item
        }))
      })
    );

    prismaMock.order.findMany.mockImplementation(
      ({
        where
      }: {
        where: {
          tenantId: string;
          status: {
            in?: string[];
            notIn?: string[];
          } | string;
        };
      }) =>
        orders.filter((order) => {
          if (order.tenantId !== where.tenantId) {
            return false;
          }

          if (typeof where.status === "string" && order.status !== where.status) {
            return false;
          }

          if (typeof where.status === "object" && where.status.in && !where.status.in.includes(order.status)) {
            return false;
          }

          if (
            typeof where.status === "object" &&
            where.status.notIn &&
            where.status.notIn.includes(order.status)
          ) {
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
      ({ where, data }: { where: { id: string }; data: { status: string } }) => {
        const order = orders.find((candidate) => candidate.id === where.id);

        return {
          ...order,
          status: data.status
        };
      }
    );

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
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
        transform: true
      })
    );
    await app.init();

    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await app?.close();
  });

  it("authenticates the pilot admin and returns scoped tokens", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "admin@burgoos.local", password: "admin123" })
      .expect(201);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toEqual(expect.any(String));
    expect(response.body.user).toMatchObject({
      id: "user-owner",
      tenantId: activeTenant.id,
      role: "OWNER",
      email: "admin@burgoos.local"
    });
  });

  it("resolves public tenants by active slug", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/public/tenants/piloto")
      .expect(200);

    expect(response.body).toMatchObject({
      id: activeTenant.id,
      slug: "piloto",
      active: true
    });
  });

  it("does not expose inactive public tenants", async () => {
    await request(app.getHttpServer()).get("/api/public/tenants/inativa").expect(404);
  });

  it("resolves admin tenant from the authenticated token", async () => {
    const login = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "admin@burgoos.local", password: "admin123" })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get("/api/admin/tenant")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: activeTenant.id,
      slug: "piloto"
    });
  });

  it("blocks admin access when token references another tenant", async () => {
    const otherTenantToken = await jwtService.signAsync(
      {
        sub: "user-other",
        tenantId: "tenant-other",
        role: "OWNER",
        email: "other@burgoos.local",
        name: "Other User"
      },
      {
        secret: "test-access-secret",
        expiresIn: "15m"
      }
    );

    await request(app.getHttpServer())
      .get("/api/admin/tenant")
      .set("Authorization", `Bearer ${otherTenantToken}`)
      .expect(404);
  });

  it("creates categories and products scoped to the authenticated tenant", async () => {
    const login = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "admin@burgoos.local", password: "admin123" })
      .expect(201);

    const category = await request(app.getHttpServer())
      .post("/api/admin/categories")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .send({ name: "Bebidas", sortOrder: 2 })
      .expect(201);

    expect(category.body).toMatchObject({
      id: "category-created",
      tenantId: activeTenant.id,
      name: "Bebidas"
    });

    const product = await request(app.getHttpServer())
      .post("/api/admin/products")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .send({
        categoryId: "22222222-2222-4222-8222-222222222222",
        name: "Burgo Especial",
        description: "Burger da casa",
        price: 34.9,
        imageUrl: "https://example.com/especial.jpg"
      })
      .expect(201);

    expect(product.body).toMatchObject({
      id: "product-created",
      tenantId: activeTenant.id,
      categoryId: "22222222-2222-4222-8222-222222222222",
      name: "Burgo Especial"
    });
  });

  it("rejects catalog writes against another tenant category", async () => {
    const login = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "admin@burgoos.local", password: "admin123" })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/admin/products")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .send({
        categoryId: "44444444-4444-4444-8444-444444444444",
        name: "Tentativa Cross Tenant",
        price: 10
      })
      .expect(404);
  });

  it("returns a public menu with only active categories and products", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/public/tenants/piloto/menu")
      .expect(200);

    expect(response.body).toMatchObject({
      tenant: {
        slug: "piloto",
        isOpen: true
      },
      categories: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Hambúrgueres",
          products: [
            {
              id: "55555555-5555-4555-8555-555555555555",
              name: "Burgo Clássico",
              price: "29.90"
            }
          ]
        }
      ]
    });
    expect(JSON.stringify(response.body)).not.toContain("66666666-6666-4666-8666-666666666666");
    expect(JSON.stringify(response.body)).not.toContain("33333333-3333-4333-8333-333333333333");
  });

  it("creates an order with server-calculated totals and WhatsApp summary", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/public/tenants/piloto/orders")
      .send({
        customerName: "Cliente Teste",
        customerPhone: "11999999999",
        fulfillmentMethod: "DELIVERY",
        paymentMethod: "PIX_MANUAL",
        deliveryAddress: {
          street: "Rua Teste",
          number: "123"
        },
        items: [
          {
            productId: "55555555-5555-4555-8555-555555555555",
            quantity: 2
          }
        ]
      })
      .expect(201);

    expect(response.body).toMatchObject({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      status: "PENDING",
      total: "59.80",
      items: [
        {
          productId: "55555555-5555-4555-8555-555555555555",
          quantity: 2,
          unitPrice: "29.90",
          total: "59.80"
        }
      ]
    });
    expect(decodeURIComponent(response.body.whatsappUrl)).toContain("Total: R$ 59.80");
  });

  it("rejects checkout when store is closed", async () => {
    await request(app.getHttpServer())
      .post("/api/public/tenants/fechada/orders")
      .send({
        customerName: "Cliente Teste",
        customerPhone: "11999999999",
        fulfillmentMethod: "PICKUP",
        paymentMethod: "CASH",
        items: [
          {
            productId: "55555555-5555-4555-8555-555555555555",
            quantity: 1
          }
        ]
      })
      .expect(409);
  });

  it("rejects checkout with inactive products or empty cart", async () => {
    await request(app.getHttpServer())
      .post("/api/public/tenants/piloto/orders")
      .send({
        customerName: "Cliente Teste",
        customerPhone: "11999999999",
        fulfillmentMethod: "PICKUP",
        paymentMethod: "CASH",
        items: [
          {
            productId: "66666666-6666-4666-8666-666666666666",
            quantity: 1
          }
        ]
      })
      .expect(409);

    await request(app.getHttpServer())
      .post("/api/public/tenants/piloto/orders")
      .send({
        customerName: "Cliente Teste",
        customerPhone: "11999999999",
        fulfillmentMethod: "PICKUP",
        paymentMethod: "CASH",
        items: []
      })
      .expect(409);
  });

  it("lists only tenant-scoped active order queue entries", async () => {
    const login = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "admin@burgoos.local", password: "admin123" })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get("/api/admin/orders")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      status: "PENDING",
      total: "59.80"
    });
    expect(JSON.stringify(response.body)).not.toContain("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
  });

  it("updates valid order statuses and rejects invalid transitions", async () => {
    const login = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "admin@burgoos.local", password: "admin123" })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch("/api/admin/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/status")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .send({ status: "PREPARING" })
      .expect(200);

    expect(updated.body).toMatchObject({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      status: "PREPARING"
    });

    await request(app.getHttpServer())
      .patch("/api/admin/orders/cccccccc-cccc-4ccc-8ccc-cccccccccccc/status")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .send({ status: "CANCELLED" })
      .expect(409);
  });

  it("returns a daily summary with delivered order revenue only", async () => {
    const login = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "admin@burgoos.local", password: "admin123" })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get("/api/admin/reports/daily-summary?date=2026-05-13")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      date: "2026-05-13",
      orderCount: 1,
      grossRevenue: "29.90"
    });
  });
});
