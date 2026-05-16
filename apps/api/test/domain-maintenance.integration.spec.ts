import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Prisma, PurchaseUnitKind, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/platform/database/prisma.service";

const tenantId = "11111111-1111-4111-8111-111111111111";
const otherTenantId = "99999999-9999-4999-8999-999999999999";
const userId = "22222222-2222-4222-8222-222222222222";
const createdAt = new Date("2026-05-15T12:00:00.000Z");

interface PurchaseUnitRecord {
  id: string;
  tenantId: string;
  name: string;
  abbreviation: string;
  kind: PurchaseUnitKind;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface SupplierRecord {
  id: string;
  tenantId: string;
  name: string;
  category: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface OrderPlatformRecord {
  id: string;
  tenantId: string;
  name: string;
  feeRate: Prisma.Decimal;
  paymentFeeRate: Prisma.Decimal;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

describe("domain maintenance integration", () => {
  let app: INestApplication;
  let passwordHash: string;
  let purchaseUnits: PurchaseUnitRecord[];
  let suppliers: SupplierRecord[];
  let orderPlatforms: OrderPlatformRecord[];

  const prismaMock = {
    user: {
      findUnique: vi.fn(),
    },
    purchaseUnit: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    supplier: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    orderPlatform: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
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
    purchaseUnits = [
      toPurchaseUnit({
        id: "33333333-3333-4333-8333-333333333333",
        tenantId: otherTenantId,
        name: "Outro quilo",
        abbreviation: "okg",
      }),
    ];
    suppliers = [];
    orderPlatforms = [];
    setupPrismaMock();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("creates, lists and updates purchase units scoped to the authenticated tenant", async () => {
    const token = await login();

    const created = await request(app.getHttpServer())
      .post("/api/admin/purchase-units")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Grama",
        abbreviation: "g",
        kind: "WEIGHT",
      })
      .expect(201);

    expect(created.body).toMatchObject({
      tenantId,
      name: "Grama",
      abbreviation: "g",
      kind: "WEIGHT",
      active: true,
    });

    const list = await request(app.getHttpServer())
      .get("/api/admin/purchase-units")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(list.body).toHaveLength(1);
    expect(list.body[0].tenantId).toBe(tenantId);

    const updated = await request(app.getHttpServer())
      .patch(`/api/admin/purchase-units/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Gramas",
        abbreviation: "gr",
        kind: "WEIGHT",
        active: false,
      })
      .expect(200);

    expect(updated.body).toMatchObject({
      name: "Gramas",
      abbreviation: "gr",
      active: false,
    });
  });

  it("rejects purchase unit updates outside the tenant scope", async () => {
    const token = await login();

    await request(app.getHttpServer())
      .patch("/api/admin/purchase-units/33333333-3333-4333-8333-333333333333")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Invasao",
        abbreviation: "inv",
        kind: "COUNT",
      })
      .expect(404);
  });

  it("creates and updates suppliers", async () => {
    const token = await login();

    const created = await request(app.getHttpServer())
      .post("/api/admin/suppliers")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Acougue Central",
        category: "Carnes",
        contactName: "Joao",
        phone: "11999999999",
        email: "joao@example.com",
        notes: "Entrega diaria",
      })
      .expect(201);

    expect(created.body).toMatchObject({
      tenantId,
      name: "Acougue Central",
      category: "Carnes",
      active: true,
    });

    const updated = await request(app.getHttpServer())
      .patch(`/api/admin/suppliers/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Acougue Central",
        category: "Proteinas",
        active: false,
      })
      .expect(200);

    expect(updated.body).toMatchObject({
      category: "Proteinas",
      active: false,
    });
  });

  it("creates and updates order platforms with decimal fee rates", async () => {
    const token = await login();

    const created = await request(app.getHttpServer())
      .post("/api/admin/order-platforms")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "iFood",
        feeRate: 0.12,
        paymentFeeRate: 0.035,
      })
      .expect(201);

    expect(created.body).toMatchObject({
      id: expect.any(String),
      name: "iFood",
      feeRate: 0.12,
      paymentFeeRate: 0.035,
      active: true,
    });

    const updated = await request(app.getHttpServer())
      .patch(`/api/admin/order-platforms/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "iFood Promocional",
        feeRate: 0.1,
        paymentFeeRate: 0.025,
        active: false,
      })
      .expect(200);

    expect(updated.body).toMatchObject({
      name: "iFood Promocional",
      feeRate: 0.1,
      paymentFeeRate: 0.025,
      active: false,
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
      tenant: {
        id: tenantId,
        active: true,
      },
    });

    prismaMock.purchaseUnit.findMany.mockImplementation(
      ({ where }: { where: { tenantId: string } }) =>
        purchaseUnits.filter((unit) => unit.tenantId === where.tenantId)
    );
    prismaMock.purchaseUnit.findFirst.mockImplementation(
      ({ where }: { where: { id: string; tenantId: string } }) =>
        purchaseUnits.find((unit) => unit.id === where.id && unit.tenantId === where.tenantId) ??
        null
    );
    prismaMock.purchaseUnit.create.mockImplementation(
      ({ data }: { data: Partial<PurchaseUnitRecord> & { tenantId: string } }) => {
        const unit = toPurchaseUnit({
          ...data,
          id: `44444444-4444-4444-8444-${String(purchaseUnits.length + 1).padStart(12, "0")}`,
        });
        purchaseUnits.push(unit);
        return unit;
      }
    );
    prismaMock.purchaseUnit.update.mockImplementation(
      ({ where, data }: { where: { id: string }; data: Partial<PurchaseUnitRecord> }) => {
        const unit = purchaseUnits.find((candidate) => candidate.id === where.id);
        Object.assign(unit as PurchaseUnitRecord, data, { updatedAt: createdAt });
        return unit;
      }
    );

    prismaMock.supplier.findMany.mockImplementation(({ where }: { where: { tenantId: string } }) =>
      suppliers.filter((supplier) => supplier.tenantId === where.tenantId)
    );
    prismaMock.supplier.findFirst.mockImplementation(
      ({ where }: { where: { id: string; tenantId: string } }) =>
        suppliers.find(
          (supplier) => supplier.id === where.id && supplier.tenantId === where.tenantId
        ) ?? null
    );
    prismaMock.supplier.create.mockImplementation(
      ({ data }: { data: Partial<SupplierRecord> & { tenantId: string } }) => {
        const supplier = toSupplier({
          ...data,
          id: `55555555-5555-4555-8555-${String(suppliers.length + 1).padStart(12, "0")}`,
        });
        suppliers.push(supplier);
        return supplier;
      }
    );
    prismaMock.supplier.update.mockImplementation(
      ({ where, data }: { where: { id: string }; data: Partial<SupplierRecord> }) => {
        const supplier = suppliers.find((candidate) => candidate.id === where.id);
        Object.assign(supplier as SupplierRecord, data, { updatedAt: createdAt });
        return supplier;
      }
    );

    prismaMock.orderPlatform.findMany.mockImplementation(
      ({ where }: { where: { tenantId: string } }) =>
        orderPlatforms.filter((platform) => platform.tenantId === where.tenantId)
    );
    prismaMock.orderPlatform.findFirst.mockImplementation(
      ({ where }: { where: { id: string; tenantId: string } }) =>
        orderPlatforms.find(
          (platform) => platform.id === where.id && platform.tenantId === where.tenantId
        ) ?? null
    );
    prismaMock.orderPlatform.create.mockImplementation(
      ({ data }: { data: Partial<OrderPlatformRecord> & { tenantId: string } }) => {
        const platform = toOrderPlatform({
          ...data,
          id: `66666666-6666-4666-8666-${String(orderPlatforms.length + 1).padStart(12, "0")}`,
        });
        orderPlatforms.push(platform);
        return platform;
      }
    );
    prismaMock.orderPlatform.update.mockImplementation(
      ({ where, data }: { where: { id: string }; data: Partial<OrderPlatformRecord> }) => {
        const platform = orderPlatforms.find((candidate) => candidate.id === where.id);
        Object.assign(platform as OrderPlatformRecord, data, { updatedAt: createdAt });
        return platform;
      }
    );
  }

  function toPurchaseUnit(
    data: Partial<PurchaseUnitRecord> & { tenantId: string }
  ): PurchaseUnitRecord {
    return {
      id: data.id ?? "33333333-3333-4333-8333-333333333333",
      tenantId: data.tenantId,
      name: data.name ?? "Unidade",
      abbreviation: data.abbreviation ?? "un",
      kind: data.kind ?? PurchaseUnitKind.COUNT,
      active: data.active ?? true,
      createdAt,
      updatedAt: createdAt,
    };
  }

  function toSupplier(data: Partial<SupplierRecord> & { tenantId: string }): SupplierRecord {
    return {
      id: data.id ?? "55555555-5555-4555-8555-555555555555",
      tenantId: data.tenantId,
      name: data.name ?? "Fornecedor",
      category: data.category ?? "Geral",
      contactName: data.contactName ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      notes: data.notes ?? null,
      active: data.active ?? true,
      createdAt,
      updatedAt: createdAt,
    };
  }

  function toOrderPlatform(
    data: Partial<OrderPlatformRecord> & { tenantId: string }
  ): OrderPlatformRecord {
    return {
      id: data.id ?? "66666666-6666-4666-8666-666666666666",
      tenantId: data.tenantId,
      name: data.name ?? "WhatsApp",
      feeRate: decimal(data.feeRate ?? 0),
      paymentFeeRate: decimal(data.paymentFeeRate ?? 0),
      active: data.active ?? true,
      createdAt,
      updatedAt: createdAt,
    };
  }

  function decimal(value: Prisma.Decimal | number | string): Prisma.Decimal {
    return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  }
});
