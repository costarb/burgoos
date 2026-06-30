import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { UserRole } from "@prisma/client";
import { hash } from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/platform/database/prisma.service";

describe("store branding", () => {
  let app: INestApplication;
  let ownerToken: string;

  const tenant = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Loja Centro",
    slug: "loja-centro",
    phone: "5511999999999",
    active: true,
    isOpen: true,
    defaultLayoutPresetKey: "classic",
  };

  const draft = {
    id: "33333333-3333-4333-8333-333333333333",
    tenantId: tenant.id,
    status: "DRAFT",
    logoUrl: "https://example.com/logo.png",
    primaryColor: "#C92A2A",
    accentColor: "#F59F00",
    neutralTheme: "LIGHT",
    layoutPresetKey: "classic",
    publishedAt: null,
  };

  const owner = {
    id: "22222222-2222-4222-8222-222222222222",
    tenantId: tenant.id,
    role: UserRole.OWNER,
    name: "Dona Maria",
    email: "maria@centro.local",
    passwordHash: "",
    tenant,
  };

  const prismaMock = {
    user: {
      findUnique: vi.fn(),
    },
    tenant: {
      findFirst: vi.fn(),
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
    category: {
      findMany: vi.fn(),
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
    owner.passwordHash = await hash("trocar123", 10);

    prismaMock.user.findUnique.mockResolvedValue(owner);
    prismaMock.tenant.findFirst.mockResolvedValue(tenant);
    prismaMock.layoutPreset.findMany.mockResolvedValue([
      {
        key: "classic",
        name: "Classico",
        description: "Menu familiar com categorias em destaque.",
        active: true,
      },
    ]);
    prismaMock.layoutPreset.findUnique.mockImplementation(
      ({ where }: { where: { key: string } }) =>
        ["classic", "compact", "visual"].includes(where.key)
          ? { key: where.key, active: true }
          : null
    );
    prismaMock.storeVisualConfiguration.findFirst.mockImplementation(
      ({ where }: { where: { status: string } }) => (where.status === "DRAFT" ? draft : null)
    );
    prismaMock.storeVisualConfiguration.update.mockResolvedValue(draft);
    prismaMock.storeVisualConfiguration.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.storeVisualConfiguration.findMany.mockResolvedValue([
      { ...draft, status: "PUBLISHED", publishedAt: new Date("2026-06-01T12:00:00.000Z") },
    ]);
    prismaMock.storeVisualConfiguration.create.mockResolvedValue(draft);
    prismaMock.category.findMany.mockResolvedValue([]);

    const login = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: owner.email, password: "trocar123" })
      .expect(201);

    ownerToken = login.body.accessToken;
  });

  afterAll(async () => {
    await app?.close();
  });

  it("saves branding drafts for the authenticated tenant", async () => {
    const response = await request(app.getHttpServer())
      .put("/api/admin/store/branding")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        logoUrl: "https://example.com/logo.png",
        primaryColor: "#c92a2a",
        accentColor: "#f59f00",
        neutralTheme: "LIGHT",
        layoutPreset: "classic",
      })
      .expect(200);

    expect(prismaMock.storeVisualConfiguration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: draft.id },
        data: expect.objectContaining({
          primaryColor: "#C92A2A",
          accentColor: "#F59F00",
        }),
      })
    );
    expect(response.body).toMatchObject({
      id: draft.id,
      status: "DRAFT",
      primaryColor: "#C92A2A",
      layoutPreset: "classic",
    });
  });

  it("accepts active layout preset choices in branding drafts", async () => {
    const response = await request(app.getHttpServer())
      .put("/api/admin/store/branding")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        logoUrl: "https://example.com/logo.png",
        primaryColor: "#C92A2A",
        accentColor: "#F59F00",
        neutralTheme: "LIGHT",
        layoutPreset: "compact",
      })
      .expect(200);

    expect(prismaMock.layoutPreset.findUnique).toHaveBeenCalledWith({
      where: { key: "compact" },
    });
    expect(prismaMock.storeVisualConfiguration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          layoutPresetKey: "compact",
        }),
      })
    );
    expect(response.body.layoutPreset).toBe("classic");
  });

  it("rejects invalid colors and unsafe color combinations", async () => {
    await request(app.getHttpServer())
      .post("/api/admin/store/branding/preview")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        primaryColor: "#fff",
        accentColor: "#F59F00",
        neutralTheme: "LIGHT",
        layoutPreset: "classic",
      })
      .expect(400);

    await request(app.getHttpServer())
      .post("/api/admin/store/branding/preview")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        primaryColor: "#C92A2A",
        accentColor: "#C92A2A",
        neutralTheme: "LIGHT",
        layoutPreset: "classic",
      })
      .expect(400);
  });

  it("exposes default branding on public menu responses", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/public/tenants/loja-centro/menu")
      .expect(200);

    expect(response.body.tenant.branding).toMatchObject({
      primaryColor: "#C92A2A",
      accentColor: "#F59F00",
      layoutPreset: "classic",
    });
  });

  it("publishes the current draft and archives previous published configuration", async () => {
    prismaMock.storeVisualConfiguration.update.mockResolvedValue({
      ...draft,
      status: "PUBLISHED",
      publishedAt: new Date("2026-06-01T12:00:00.000Z"),
    });

    const response = await request(app.getHttpServer())
      .post("/api/admin/store/branding/publish")
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(201);

    expect(prismaMock.storeVisualConfiguration.updateMany).toHaveBeenCalledWith({
      where: { tenantId: tenant.id, status: "PUBLISHED" },
      data: { status: "ARCHIVED" },
    });
    expect(response.body).toMatchObject({
      id: draft.id,
      status: "PUBLISHED",
      layoutPreset: "classic",
    });
  });

  it("lists published visual configuration history", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/admin/store/branding/history")
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);

    expect(prismaMock.storeVisualConfiguration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: tenant.id,
        }),
      })
    );
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({ status: "PUBLISHED" });
  });

  it("restores the most recent archived visual configuration", async () => {
    prismaMock.storeVisualConfiguration.findFirst.mockImplementation(
      ({ where }: { where: { status: string } }) => {
        if (where.status === "ARCHIVED") {
          return {
            ...draft,
            id: "44444444-4444-4444-8444-444444444444",
            status: "ARCHIVED",
            publishedAt: new Date("2026-05-31T12:00:00.000Z"),
          };
        }

        return where.status === "DRAFT" ? draft : null;
      }
    );
    prismaMock.storeVisualConfiguration.update.mockResolvedValue({
      ...draft,
      id: "44444444-4444-4444-8444-444444444444",
      status: "PUBLISHED",
      publishedAt: new Date("2026-06-01T12:00:00.000Z"),
    });

    const response = await request(app.getHttpServer())
      .post("/api/admin/store/branding/restore")
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(201);

    expect(response.body).toMatchObject({
      id: "44444444-4444-4444-8444-444444444444",
      status: "PUBLISHED",
    });
  });
});
