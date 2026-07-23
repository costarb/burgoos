import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { UserRole } from "@prisma/client";
import { hash } from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/platform/database/prisma.service";

describe("store onboarding", () => {
  let app: INestApplication;
  let platformToken: string;

  const tenant = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Loja Centro",
    slug: "loja-centro",
    publicDomain: null as string | null,
    phone: "5511999999999",
    active: true,
    isOpen: false,
    defaultLayoutPresetKey: "classic",
    setupCompletedAt: new Date("2026-06-01T12:00:00.000Z"),
    deactivatedAt: null,
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

    const platformPasswordHash = await hash("admin123", 10);
    owner.passwordHash = await hash("trocar123", 10);

    prismaMock.platformUser.findUnique.mockResolvedValue({
      id: "99999999-9999-4999-8999-999999999999",
      role: "SUPER_ADMIN",
      name: "Admin Plataforma",
      email: "platform@burgoos.local",
      passwordHash: platformPasswordHash,
      active: true,
    });

    prismaMock.tenant.findMany.mockResolvedValue([{ ...tenant, users: [owner] }]);
    prismaMock.tenant.findFirst.mockImplementation(
      ({ where }: { where: { id?: string; slug?: string; active?: boolean } }) => {
        if (where.id && where.id !== tenant.id) {
          return null;
        }

        if (where.slug && where.slug !== tenant.slug) {
          return null;
        }

        if (where.active !== undefined && where.active !== tenant.active) {
          return null;
        }

        return {
          ...tenant,
          users: [owner],
          visualConfigurations: [],
        };
      }
    );
    prismaMock.tenant.findUnique.mockImplementation(
      ({ where }: { where: { slug?: string; publicDomain?: string; id?: string } }) => {
        if (where.publicDomain) return where.publicDomain === tenant.publicDomain ? tenant : null;
        if (where.id) return where.id === tenant.id ? tenant : null;
        return where.slug === tenant.slug ? tenant : null;
      }
    );
    prismaMock.tenant.create.mockResolvedValue(tenant);
    prismaMock.tenant.update.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      ...tenant,
      ...data,
      users: [owner],
      visualConfigurations: [],
    }));

    prismaMock.user.findUnique.mockImplementation(({ where }: { where: { email: string } }) => {
      if (where.email === owner.email) {
        return owner;
      }

      return null;
    });
    prismaMock.user.create.mockResolvedValue(owner);

    const login = await request(app.getHttpServer())
      .post("/api/auth/platform/login")
      .send({ email: "platform@burgoos.local", password: "admin123" })
      .expect(201);

    platformToken = login.body.accessToken;
  });

  afterAll(async () => {
    await app?.close();
  });

  it("creates a store with normalized slug and responsible owner", async () => {
    prismaMock.tenant.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .post("/api/platform/stores")
      .set("Authorization", `Bearer ${platformToken}`)
      .send({
        name: "Loja Centro",
        slug: " Loja Centro ",
        phone: "5511999999999",
        owner: {
          name: "Dona Maria",
          email: "maria@centro.local",
          temporaryPassword: "trocar123",
        },
      })
      .expect(201);

    expect(prismaMock.tenant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: "loja-centro",
          active: true,
          isOpen: false,
          defaultLayoutPresetKey: "classic",
        }),
      })
    );
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: tenant.id,
          role: UserRole.OWNER,
          email: "maria@centro.local",
        }),
      })
    );
    expect(response.body).toMatchObject({
      store: {
        id: tenant.id,
        slug: "loja-centro",
      },
      owner: {
        id: owner.id,
        email: "maria@centro.local",
      },
    });
  });

  it("rejects duplicate and reserved slugs", async () => {
    await request(app.getHttpServer())
      .post("/api/platform/stores")
      .set("Authorization", `Bearer ${platformToken}`)
      .send({
        name: "Duplicada",
        slug: "loja-centro",
        phone: "5511888888888",
        owner: {
          name: "Outra Pessoa",
          email: "outra@centro.local",
          temporaryPassword: "trocar123",
        },
      })
      .expect(409);

    await request(app.getHttpServer())
      .post("/api/platform/stores")
      .set("Authorization", `Bearer ${platformToken}`)
      .send({
        name: "Admin",
        slug: "admin",
        phone: "5511888888888",
        owner: {
          name: "Outra Pessoa",
          email: "outra@centro.local",
          temporaryPassword: "trocar123",
        },
      })
      .expect(400);
  });

  it("normalizes, returns and removes the public domain", async () => {
    const configured = await request(app.getHttpServer())
      .patch(`/api/platform/stores/${tenant.id}`)
      .set("Authorization", `Bearer ${platformToken}`)
      .send({ publicDomain: "WWW.Loja-Centro.com.br." })
      .expect(200);

    expect(prismaMock.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ publicDomain: "loja-centro.com.br" }) })
    );
    expect(configured.body).toMatchObject({
      publicDomain: "loja-centro.com.br",
      publicMenuUrl: "https://loja-centro.com.br/cardapio",
    });

    await request(app.getHttpServer())
      .patch(`/api/platform/stores/${tenant.id}`)
      .set("Authorization", `Bearer ${platformToken}`)
      .send({ publicDomain: "" })
      .expect(200);
    expect(prismaMock.tenant.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ publicDomain: null }) })
    );

    prismaMock.tenant.findUnique.mockResolvedValueOnce({ ...tenant, id: "other-store" });
    await request(app.getHttpServer())
      .patch(`/api/platform/stores/${tenant.id}`)
      .set("Authorization", `Bearer ${platformToken}`)
      .send({ publicDomain: "dominio-em-uso.example.com" })
      .expect(409);
  });

  it("allows owner login scoped to the created tenant", async () => {
    const login = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "maria@centro.local", password: "trocar123" })
      .expect(201);

    expect(login.body.user).toMatchObject({
      tenantId: tenant.id,
      role: UserRole.OWNER,
      email: "maria@centro.local",
    });

    const store = await request(app.getHttpServer())
      .get(`/api/platform/stores/${tenant.id}`)
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .expect(403);

    expect(store.body.message).toBe("Acesso restrito a administradores da plataforma");
  });

  it("returns launch readiness for required store setup", async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/platform/stores/${tenant.id}/readiness`)
      .set("Authorization", `Bearer ${platformToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      ready: true,
      checks: expect.arrayContaining([
        expect.objectContaining({ key: "slug", passed: true }),
        expect.objectContaining({ key: "owner", passed: true }),
        expect.objectContaining({ key: "branding", passed: true }),
      ]),
    });
  });
});
