import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Prisma, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/platform/database/prisma.service";

const tenantId = "11111111-1111-4111-8111-111111111111";
const otherTenantId = "99999999-9999-4999-8999-999999999999";
const userId = "22222222-2222-4222-8222-222222222222";
const productId = "33333333-3333-4333-8333-333333333333";
const ingredientId = "44444444-4444-4444-8444-444444444444";
const packagingId = "55555555-5555-4555-8555-555555555555";
const createdAt = new Date("2026-05-15T12:00:00.000Z");

interface IngredientRecord {
  id: string;
  tenantId: string;
  name: string;
  unitCost: Prisma.Decimal;
  active: boolean;
}

interface TechnicalSheetLineRecord {
  id: string;
  tenantId: string;
  technicalSheetId: string;
  ingredientId: string;
  quantityUsed: Prisma.Decimal;
  unitCostSnapshot: Prisma.Decimal;
  itemCost: Prisma.Decimal;
  isPackaging: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  ingredient: IngredientRecord;
}

interface TechnicalSheetRecord {
  id: string;
  tenantId: string;
  productId: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  lines: TechnicalSheetLineRecord[];
}

describe("technical sheet integration", () => {
  let app: INestApplication;
  let passwordHash: string;
  let technicalSheet: TechnicalSheetRecord | null;
  let ingredients: IngredientRecord[];

  const prismaMock = {
    user: { findUnique: vi.fn() },
    product: { findFirst: vi.fn() },
    ingredient: { findMany: vi.fn() },
    technicalSheet: {
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
    technicalSheet = null;
    ingredients = [
      {
        id: ingredientId,
        tenantId,
        name: "Blend bovino",
        unitCost: decimal("0.038"),
        active: true,
      },
      { id: packagingId, tenantId, name: "Embalagem", unitCost: decimal("1.40"), active: true },
      {
        id: "77777777-7777-4777-8777-777777777777",
        tenantId: otherTenantId,
        name: "Outro insumo",
        unitCost: decimal("10"),
        active: true,
      },
    ];
    setupPrismaMock();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("returns an incomplete technical sheet when the product has no active sheet", async () => {
    const token = await login();

    const response = await request(app.getHttpServer())
      .get(`/api/admin/products/${productId}/technical-sheet`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({
      productId,
      complete: false,
      ingredientCmv: "0.00",
      lines: [],
    });
  });

  it("replaces product technical sheet lines and calculates product CMV", async () => {
    const token = await login();

    const response = await request(app.getHttpServer())
      .put(`/api/admin/products/${productId}/technical-sheet`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        lines: [
          { ingredientId, quantityUsed: 180 },
          { ingredientId: packagingId, quantityUsed: 1, isPackaging: true, notes: "Caixa" },
        ],
      })
      .expect(200);

    expect(response.body).toMatchObject({
      productId,
      complete: true,
      ingredientCmv: "8.24",
      lines: [
        {
          ingredientId,
          ingredientName: "Blend bovino",
          quantityUsed: 180,
          unitCostSnapshot: "0.0380",
          itemCost: "6.84",
          isPackaging: false,
        },
        {
          ingredientId: packagingId,
          ingredientName: "Embalagem",
          quantityUsed: 1,
          itemCost: "1.40",
          isPackaging: true,
        },
      ],
    });

    const summaries = await request(app.getHttpServer())
      .get("/api/admin/technical-sheets")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(summaries.body).toEqual([
      {
        productId,
        complete: true,
        lineCount: 2,
        ingredientCmv: "8.24",
      },
    ]);
  });

  it("rejects technical sheets with ingredients outside the tenant scope", async () => {
    const token = await login();

    await request(app.getHttpServer())
      .put(`/api/admin/products/${productId}/technical-sheet`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        lines: [
          {
            ingredientId: "77777777-7777-4777-8777-777777777777",
            quantityUsed: 1,
          },
        ],
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

    prismaMock.product.findFirst.mockImplementation(
      ({ where }: { where: { id: string; tenantId: string } }) =>
        where.id === productId && where.tenantId === tenantId ? { id: productId } : null
    );
    prismaMock.ingredient.findMany.mockImplementation(
      ({ where }: { where: { tenantId: string; id: { in: string[] }; active?: boolean } }) =>
        ingredients.filter(
          (ingredient) =>
            ingredient.tenantId === where.tenantId &&
            where.id.in.includes(ingredient.id) &&
            (typeof where.active === "boolean" ? ingredient.active === where.active : true)
        )
    );
    prismaMock.technicalSheet.findMany.mockImplementation(
      ({ where }: { where: { tenantId: string; active: boolean } }) =>
        technicalSheet &&
        technicalSheet.tenantId === where.tenantId &&
        technicalSheet.active === where.active
          ? [technicalSheet]
          : []
    );
    prismaMock.technicalSheet.findFirst.mockImplementation(
      ({ where }: { where: { tenantId: string; productId: string; active: boolean } }) =>
        technicalSheet &&
        technicalSheet.tenantId === where.tenantId &&
        technicalSheet.productId === where.productId &&
        technicalSheet.active === where.active
          ? technicalSheet
          : null
    );
    prismaMock.technicalSheet.create.mockImplementation(
      ({
        data,
      }: {
        data: {
          tenantId: string;
          productId: string;
          active: boolean;
          lines: { create: Array<Partial<TechnicalSheetLineRecord> & { ingredientId: string }> };
        };
      }) => {
        technicalSheet = toTechnicalSheet(data);
        return technicalSheet;
      }
    );
    prismaMock.technicalSheet.update.mockImplementation(
      ({
        data,
      }: {
        data: {
          lines: { create: Array<Partial<TechnicalSheetLineRecord> & { ingredientId: string }> };
        };
      }) => {
        technicalSheet = toTechnicalSheet({
          tenantId,
          productId,
          active: true,
          lines: data.lines,
        });
        return technicalSheet;
      }
    );
  }

  function toTechnicalSheet(data: {
    tenantId: string;
    productId: string;
    active: boolean;
    lines: { create: Array<Partial<TechnicalSheetLineRecord> & { ingredientId: string }> };
  }): TechnicalSheetRecord {
    const sheetId = "88888888-8888-4888-8888-888888888888";
    return {
      id: sheetId,
      tenantId: data.tenantId,
      productId: data.productId,
      active: data.active,
      createdAt,
      updatedAt: createdAt,
      lines: data.lines.create.map((line, index) => {
        const ingredient = ingredients.find((candidate) => candidate.id === line.ingredientId);
        if (!ingredient) {
          throw new Error(`Missing ingredient ${line.ingredientId}`);
        }

        return {
          id: `99999999-9999-4999-8999-${String(index + 1).padStart(12, "0")}`,
          tenantId: data.tenantId,
          technicalSheetId: sheetId,
          ingredientId: line.ingredientId,
          quantityUsed: decimal(line.quantityUsed ?? 1),
          unitCostSnapshot: decimal(line.unitCostSnapshot ?? ingredient.unitCost),
          itemCost: decimal(line.itemCost ?? 0),
          isPackaging: line.isPackaging ?? false,
          notes: line.notes ?? null,
          createdAt,
          updatedAt: createdAt,
          ingredient,
        };
      }),
    };
  }

  function decimal(value: Prisma.Decimal | number | string): Prisma.Decimal {
    return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  }
});
