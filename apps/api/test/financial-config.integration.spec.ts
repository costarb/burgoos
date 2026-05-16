import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Prisma, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/platform/database/prisma.service";

const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const configurationId = "33333333-3333-4333-8333-333333333333";
const createdAt = new Date("2026-05-15T12:00:00.000Z");

interface FinancialConfigurationRecord {
  id: string;
  tenantId: string;
  taxRate: Prisma.Decimal;
  cardFeeRate: Prisma.Decimal;
  operationalLossRate: Prisma.Decimal;
  desiredMarginRate: Prisma.Decimal;
  averagePackagingCost: Prisma.Decimal;
  monthlyFixedCost: Prisma.Decimal;
  monthlyRevenueGoal: Prisma.Decimal;
  cmvWarningRate: Prisma.Decimal;
  netMarginGoalRate: Prisma.Decimal;
  createdAt: Date;
  updatedAt: Date;
}

describe("financial configuration integration", () => {
  let app: INestApplication;
  let passwordHash: string;
  let configuration: FinancialConfigurationRecord | null;

  const prismaMock = {
    user: {
      findUnique: vi.fn(),
    },
    financialConfiguration: {
      upsert: vi.fn(),
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
    configuration = null;

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

    prismaMock.financialConfiguration.upsert.mockImplementation(
      ({
        update,
        create,
      }: {
        update: Partial<FinancialConfigurationRecord>;
        create: Partial<FinancialConfigurationRecord> & { tenantId: string };
      }) => {
        if (!configuration) {
          configuration = toRecord(create);
        } else {
          configuration = {
            ...configuration,
            ...update,
            updatedAt: createdAt,
          };
        }

        return configuration;
      }
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  it("creates the tenant default configuration on first read", async () => {
    const token = await login();

    const response = await request(app.getHttpServer())
      .get("/api/admin/financial/config")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: configurationId,
      taxRate: 0,
      cardFeeRate: 0,
      desiredMarginRate: 0.3,
      averagePackagingCost: "0.00",
    });
    expect(prismaMock.financialConfiguration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId },
        create: { tenantId },
      })
    );
  });

  it("updates all financial parameters for the tenant", async () => {
    const token = await login();

    const response = await request(app.getHttpServer())
      .put("/api/admin/financial/config")
      .set("Authorization", `Bearer ${token}`)
      .send({
        taxRate: 0.06,
        cardFeeRate: 0.035,
        operationalLossRate: 0.03,
        desiredMarginRate: 0.32,
        averagePackagingCost: 2.5,
        monthlyFixedCost: 8000,
        monthlyRevenueGoal: 35000,
        cmvWarningRate: 0.35,
        netMarginGoalRate: 0.15,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      taxRate: 0.06,
      cardFeeRate: 0.035,
      operationalLossRate: 0.03,
      desiredMarginRate: 0.32,
      averagePackagingCost: "2.50",
      monthlyFixedCost: "8000.00",
      monthlyRevenueGoal: "35000.00",
      cmvWarningRate: 0.35,
      netMarginGoalRate: 0.15,
    });
  });

  async function login(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "admin@burgoos.local", password: "admin123" })
      .expect(201);

    return response.body.accessToken as string;
  }

  function toRecord(
    data: Partial<FinancialConfigurationRecord> & { tenantId: string }
  ): FinancialConfigurationRecord {
    return {
      id: data.id ?? configurationId,
      tenantId: data.tenantId,
      taxRate: decimal(data.taxRate ?? 0),
      cardFeeRate: decimal(data.cardFeeRate ?? 0),
      operationalLossRate: decimal(data.operationalLossRate ?? 0),
      desiredMarginRate: decimal(data.desiredMarginRate ?? 0.3),
      averagePackagingCost: decimal(data.averagePackagingCost ?? 0),
      monthlyFixedCost: decimal(data.monthlyFixedCost ?? 0),
      monthlyRevenueGoal: decimal(data.monthlyRevenueGoal ?? 0),
      cmvWarningRate: decimal(data.cmvWarningRate ?? 0.35),
      netMarginGoalRate: decimal(data.netMarginGoalRate ?? 0.15),
      createdAt,
      updatedAt: createdAt,
    };
  }

  function decimal(value: Prisma.Decimal | number | string): Prisma.Decimal {
    return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  }
});
