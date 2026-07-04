import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { UserRole } from "@prisma/client";
import { hash } from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/platform/database/prisma.service";

describe("store onboarding and branding flow", () => {
  let app: INestApplication;

  const tenants: Array<{
    id: string;
    name: string;
    slug: string;
    phone: string;
    active: boolean;
    isOpen: boolean;
    defaultLayoutPresetKey: string;
  }> = [];
  const users: Array<{
    id: string;
    tenantId: string;
    role: UserRole;
    name: string;
    email: string;
    passwordHash: string;
  }> = [];
  const visualConfigurations: Array<{
    id: string;
    tenantId: string;
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    logoUrl: string | null;
    headerImageUrl: string | null;
    bodyImageUrl: string | null;
    footerImageUrl: string | null;
    primaryColor: string;
    accentColor: string;
    neutralTheme: "LIGHT" | "DARK" | "SYSTEM_DEFAULT";
    layoutPresetKey: string;
    publishedAt: Date | null;
  }> = [];

  const prismaMock = {
    platformUser: {
      findUnique: vi.fn(),
    },
    tenant: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    layoutPreset: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    storeVisualConfiguration: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

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

  beforeEach(async () => {
    vi.clearAllMocks();
    tenants.length = 0;
    users.length = 0;
    visualConfigurations.length = 0;

    const platformPasswordHash = await hash("admin123", 10);

    prismaMock.platformUser.findUnique.mockResolvedValue({
      id: "99999999-9999-4999-8999-999999999999",
      role: "SUPER_ADMIN",
      name: "Admin Plataforma",
      email: "platform@burgoos.local",
      passwordHash: platformPasswordHash,
      active: true,
    });

    prismaMock.tenant.findMany.mockImplementation(() =>
      tenants.map((tenant) => ({
        ...tenant,
        users: users.filter((user) => user.tenantId === tenant.id),
        visualConfigurations: visualConfigurations.filter(
          (configuration) => configuration.tenantId === tenant.id
        ),
      }))
    );
    prismaMock.tenant.findUnique.mockImplementation(
      ({ where }: { where: { slug: string } }) =>
        tenants.find((tenant) => tenant.slug === where.slug) ?? null
    );
    prismaMock.tenant.findFirst.mockImplementation(
      ({ where }: { where: { id?: string; slug?: string; active?: boolean } }) => {
        return (
          tenants.find((tenant) => {
            if (where.id && tenant.id !== where.id) {
              return false;
            }
            if (where.slug && tenant.slug !== where.slug) {
              return false;
            }
            if (where.active !== undefined && tenant.active !== where.active) {
              return false;
            }
            return true;
          }) ?? null
        );
      }
    );
    prismaMock.tenant.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => {
      const tenant = {
        id: "11111111-1111-4111-8111-111111111111",
        name: String(data.name),
        slug: String(data.slug),
        phone: String(data.phone),
        active: Boolean(data.active),
        isOpen: Boolean(data.isOpen),
        defaultLayoutPresetKey: String(data.defaultLayoutPresetKey),
      };
      tenants.push(tenant);
      return tenant;
    });

    prismaMock.user.findUnique.mockImplementation(({ where }: { where: { email: string } }) => {
      const user = users.find((candidate) => candidate.email === where.email);
      if (!user) {
        return null;
      }
      return {
        ...user,
        tenant: tenants.find((tenant) => tenant.id === user.tenantId),
      };
    });
    prismaMock.user.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => {
      const user = {
        id: "22222222-2222-4222-8222-222222222222",
        tenantId: String(data.tenantId),
        role: data.role as UserRole,
        name: String(data.name),
        email: String(data.email),
        passwordHash: String(data.passwordHash),
      };
      users.push(user);
      return user;
    });

    prismaMock.layoutPreset.findMany.mockResolvedValue([
      { key: "classic", name: "Classico", description: "Padrao", active: true },
      { key: "visual", name: "Visual", description: "Fotos em destaque", active: true },
    ]);
    prismaMock.layoutPreset.findUnique.mockImplementation(
      ({ where }: { where: { key: string } }) =>
        ["classic", "compact", "visual"].includes(where.key)
          ? { key: where.key, active: true }
          : null
    );

    prismaMock.storeVisualConfiguration.findFirst.mockImplementation(
      ({ where }: { where: { tenantId: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" } }) => {
        return (
          visualConfigurations
            .filter(
              (configuration) =>
                configuration.tenantId === where.tenantId && configuration.status === where.status
            )
            .sort((left, right) => {
              const leftTime = left.publishedAt?.getTime() ?? 0;
              const rightTime = right.publishedAt?.getTime() ?? 0;
              return rightTime - leftTime;
            })[0] ?? null
        );
      }
    );
    prismaMock.storeVisualConfiguration.findMany.mockImplementation(
      ({ where }: { where: { tenantId: string } }) =>
        visualConfigurations.filter(
          (configuration) =>
            configuration.tenantId === where.tenantId && configuration.status !== "DRAFT"
        )
    );
    prismaMock.storeVisualConfiguration.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => {
        const configuration = {
          id: `33333333-3333-4333-8333-33333333333${visualConfigurations.length}`,
          tenantId: String(data.tenantId),
          status: "DRAFT" as const,
          logoUrl: data.logoUrl ? String(data.logoUrl) : null,
          headerImageUrl: data.headerImageUrl ? String(data.headerImageUrl) : null,
          bodyImageUrl: data.bodyImageUrl ? String(data.bodyImageUrl) : null,
          footerImageUrl: data.footerImageUrl ? String(data.footerImageUrl) : null,
          primaryColor: String(data.primaryColor),
          accentColor: String(data.accentColor),
          neutralTheme: data.neutralTheme as "LIGHT",
          layoutPresetKey: String(data.layoutPresetKey),
          publishedAt: null,
        };
        visualConfigurations.push(configuration);
        return configuration;
      }
    );
    prismaMock.storeVisualConfiguration.update.mockImplementation(
      ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const configuration = visualConfigurations.find((candidate) => candidate.id === where.id);
        if (!configuration) {
          throw new Error("Configuration not found");
        }
        Object.assign(configuration, data);
        return configuration;
      }
    );
    prismaMock.storeVisualConfiguration.updateMany.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { tenantId: string; status: string };
        data: Record<string, unknown>;
      }) => {
        let count = 0;
        for (const configuration of visualConfigurations) {
          if (configuration.tenantId === where.tenantId && configuration.status === where.status) {
            Object.assign(configuration, data);
            count += 1;
          }
        }
        return { count };
      }
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  it("creates a store, logs in as owner, publishes branding and restores previous branding", async () => {
    const platformLogin = await request(app.getHttpServer())
      .post("/api/auth/platform/login")
      .send({ email: "platform@burgoos.local", password: "admin123" })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/platform/stores")
      .set("Authorization", `Bearer ${platformLogin.body.accessToken}`)
      .send({
        name: "Loja Centro",
        slug: "loja-centro",
        phone: "5511999999999",
        owner: {
          name: "Dona Maria",
          email: "maria@centro.local",
          temporaryPassword: "trocar123",
        },
      })
      .expect(201);

    const ownerLogin = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "maria@centro.local", password: "trocar123" })
      .expect(201);

    await request(app.getHttpServer())
      .put("/api/admin/store/branding")
      .set("Authorization", `Bearer ${ownerLogin.body.accessToken}`)
      .send({
        primaryColor: "#C92A2A",
        accentColor: "#F59F00",
        neutralTheme: "LIGHT",
        layoutPreset: "classic",
      })
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/admin/store/branding/publish")
      .set("Authorization", `Bearer ${ownerLogin.body.accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .put("/api/admin/store/branding")
      .set("Authorization", `Bearer ${ownerLogin.body.accessToken}`)
      .send({
        primaryColor: "#2F9E44",
        accentColor: "#364FC7",
        neutralTheme: "LIGHT",
        layoutPreset: "visual",
      })
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/admin/store/branding/publish")
      .set("Authorization", `Bearer ${ownerLogin.body.accessToken}`)
      .expect(201);

    const restored = await request(app.getHttpServer())
      .post("/api/admin/store/branding/restore")
      .set("Authorization", `Bearer ${ownerLogin.body.accessToken}`)
      .expect(201);

    expect(restored.body).toMatchObject({
      status: "PUBLISHED",
      primaryColor: "#C92A2A",
      layoutPreset: "classic",
    });
  });
});
