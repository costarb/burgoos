import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PermissionGuard } from "../src/auth/guards/permission.guard";
import { JwtAuthGuard } from "../src/platform/auth/jwt-auth.guard";
import { SalesIntegrationController } from "../src/management/sales-integrations/sales-integration.controller";
import { SalesIntegrationService } from "../src/management/sales-integrations/sales-integration.service";
import { SalesProviderRegistry } from "../src/management/sales-integrations/sales-provider.registry";

describe("sales integration configuration HTTP contract", () => {
  let app: INestApplication;
  const service = { list: vi.fn(), create: vi.fn(), get: vi.fn(), update: vi.fn(), rotateCredential: vi.fn(), setStatus: vi.fn() };
  const registry = { listCapabilities: vi.fn(() => [{ provider: "PAGBANK", channels: ["API"], maxPeriodDays: 31, supportsPreview: true, requiredSettings: ["externalMerchantId", "credential"] }]) };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [SalesIntegrationController], providers: [{ provide: SalesIntegrationService, useValue: service }, { provide: SalesProviderRegistry, useValue: registry }] })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: (context: { switchToHttp(): { getRequest(): { user?: unknown } } }) => { context.switchToHttp().getRequest().user = { id: "actor", tenantId: "tenant-a", role: "STORE_ADMIN", permissions: [] }; return true; } })
      .overrideGuard(PermissionGuard).useValue({ canActivate: () => true }).compile();
    app = module.createNestApplication(); app.setGlobalPrefix("api"); app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true })); await app.init();
  });
  afterAll(() => app.close());
  it("exposes provider capabilities and scopes integration reads to the JWT tenant", async () => {
    service.list.mockResolvedValue([]);
    await request(app.getHttpServer()).get("/api/admin/sales-integrations/providers").expect(200).expect(({ body }) => expect(body[0].provider).toBe("PAGBANK"));
    await request(app.getHttpServer()).get("/api/admin/sales-integrations").expect(200);
    expect(service.list).toHaveBeenCalledWith("tenant-a");
  });
  it("accepts configuration and write-only credentials without serializing the token", async () => {
    service.create.mockResolvedValue({ id: "integration", hasCredential: false }); service.rotateCredential.mockResolvedValue(undefined); service.setStatus.mockResolvedValue({ id: "integration", status: "ACTIVE", hasCredential: true });
    await request(app.getHttpServer()).post("/api/admin/sales-integrations").send({ provider: "PAGBANK", channel: "API", displayName: "PagBank", externalMerchantId: "USER" }).expect(201);
    const credential = await request(app.getHttpServer()).put("/api/admin/sales-integrations/integration/credentials").send({ token: "write-only" }).expect(200);
    expect(JSON.stringify(credential.body)).not.toContain("write-only");
    await request(app.getHttpServer()).patch("/api/admin/sales-integrations/integration/status").send({ status: "ACTIVE" }).expect(200);
    expect(service.rotateCredential).toHaveBeenCalledWith("tenant-a", "actor", "integration", { token: "write-only" });
  });
});
