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
const unitId = "33333333-3333-4333-8333-333333333333";
const supplierId = "44444444-4444-4444-8444-444444444444";
const createdAt = new Date("2026-05-15T12:00:00.000Z");

interface IngredientRecord {
  id: string;
  tenantId: string;
  purchaseUnitId: string;
  supplierId: string | null;
  name: string;
  category: string;
  purchaseQuantity: Prisma.Decimal;
  purchaseCost: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  currentStock: Prisma.Decimal;
  minimumStock: Prisma.Decimal;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

describe("ingredients integration", () => {
  let app: INestApplication;
  let passwordHash: string;
  let ingredients: IngredientRecord[];

  const prismaMock = {
    user: { findUnique: vi.fn() },
    purchaseUnit: { findFirst: vi.fn() },
    supplier: { findFirst: vi.fn() },
    ingredient: {
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
    ingredients = [
      toIngredient({
        id: "55555555-5555-4555-8555-555555555555",
        tenantId: otherTenantId,
        name: "Insumo de outra loja",
      }),
    ];
    setupPrismaMock();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("creates, lists and updates ingredients with calculated unit cost", async () => {
    const token = await login();

    const created = await request(app.getHttpServer())
      .post("/api/admin/ingredients")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Blend bovino",
        category: "Carnes",
        purchaseUnitId: unitId,
        supplierId,
        purchaseQuantity: 1000,
        purchaseCost: 38,
        currentStock: 15000,
        minimumStock: 5000,
      })
      .expect(201);

    expect(created.body).toMatchObject({
      name: "Blend bovino",
      category: "Carnes",
      purchaseUnitId: unitId,
      supplierId,
      purchaseQuantity: 1000,
      purchaseCost: "38.00",
      unitCost: "0.0380",
      currentStock: 15000,
      minimumStock: 5000,
      active: true,
    });

    const list = await request(app.getHttpServer())
      .get("/api/admin/ingredients")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(list.body).toHaveLength(1);
    expect(list.body[0].name).toBe("Blend bovino");

    const updated = await request(app.getHttpServer())
      .patch(`/api/admin/ingredients/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Blend bovino premium",
        category: "Carnes",
        purchaseUnitId: unitId,
        supplierId,
        purchaseQuantity: 1000,
        purchaseCost: 42,
        currentStock: 12000,
        minimumStock: 4000,
        active: false,
      })
      .expect(200);

    expect(updated.body).toMatchObject({
      name: "Blend bovino premium",
      purchaseCost: "42.00",
      unitCost: "0.0420",
      active: false,
    });
  });

  it("rejects updates outside the tenant scope", async () => {
    const token = await login();

    await request(app.getHttpServer())
      .patch("/api/admin/ingredients/55555555-5555-4555-8555-555555555555")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Invasao",
        category: "Carnes",
        purchaseUnitId: unitId,
        purchaseQuantity: 1000,
        purchaseCost: 38,
      })
      .expect(404);
  });

  it("rejects ingredients that reference inactive or foreign domains", async () => {
    const token = await login();
    prismaMock.purchaseUnit.findFirst.mockResolvedValueOnce(null);

    await request(app.getHttpServer())
      .post("/api/admin/ingredients")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Blend bovino",
        category: "Carnes",
        purchaseUnitId: unitId,
        purchaseQuantity: 1000,
        purchaseCost: 38,
      })
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

    prismaMock.purchaseUnit.findFirst.mockImplementation(
      ({ where }: { where: { id: string; tenantId: string; active?: boolean } }) =>
        where.id === unitId && where.tenantId === tenantId && where.active === true
          ? { id: unitId, kind: PurchaseUnitKind.WEIGHT }
          : null
    );
    prismaMock.supplier.findFirst.mockImplementation(
      ({ where }: { where: { id: string; tenantId: string; active?: boolean } }) =>
        where.id === supplierId && where.tenantId === tenantId && where.active === true
          ? { id: supplierId }
          : null
    );
    prismaMock.ingredient.findMany.mockImplementation(
      ({ where }: { where: { tenantId: string } }) =>
        ingredients.filter((ingredient) => ingredient.tenantId === where.tenantId)
    );
    prismaMock.ingredient.findFirst.mockImplementation(
      ({ where }: { where: { id: string; tenantId: string } }) =>
        ingredients.find(
          (ingredient) => ingredient.id === where.id && ingredient.tenantId === where.tenantId
        ) ?? null
    );
    prismaMock.ingredient.create.mockImplementation(
      ({ data }: { data: Partial<IngredientRecord> & { tenantId: string } }) => {
        const ingredient = toIngredient({
          ...data,
          id: `66666666-6666-4666-8666-${String(ingredients.length + 1).padStart(12, "0")}`,
        });
        ingredients.push(ingredient);
        return ingredient;
      }
    );
    prismaMock.ingredient.update.mockImplementation(
      ({ where, data }: { where: { id: string }; data: Partial<IngredientRecord> }) => {
        const ingredient = ingredients.find((candidate) => candidate.id === where.id);
        Object.assign(ingredient as IngredientRecord, data, { updatedAt: createdAt });
        return ingredient;
      }
    );
  }

  function toIngredient(data: Partial<IngredientRecord> & { tenantId: string }): IngredientRecord {
    return {
      id: data.id ?? "66666666-6666-4666-8666-666666666666",
      tenantId: data.tenantId,
      purchaseUnitId: data.purchaseUnitId ?? unitId,
      supplierId: data.supplierId ?? supplierId,
      name: data.name ?? "Insumo",
      category: data.category ?? "Geral",
      purchaseQuantity: decimal(data.purchaseQuantity ?? 1000),
      purchaseCost: decimal(data.purchaseCost ?? 38),
      unitCost: decimal(data.unitCost ?? 0.038),
      currentStock: decimal(data.currentStock ?? 0),
      minimumStock: decimal(data.minimumStock ?? 0),
      active: data.active ?? true,
      createdAt,
      updatedAt: createdAt,
    };
  }

  function decimal(value: Prisma.Decimal | number | string): Prisma.Decimal {
    return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  }
});
