import {
  CanActivate,
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PermissionGuard } from "../src/auth/guards/permission.guard";
import { MercadoPagoCallbackController } from "../src/management/sales-integrations/mercado-pago/mercado-pago-callback.controller";
import { MercadoPagoConnectionController } from "../src/management/sales-integrations/mercado-pago/mercado-pago-connection.controller";
import { MercadoPagoConnectionService } from "../src/management/sales-integrations/mercado-pago/mercado-pago-connection.service";
import { JwtAuthGuard } from "../src/platform/auth/jwt-auth.guard";

class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    if (request.headers.authorization !== "Bearer admin") return false;
    request.user = {
      id: "admin",
      tenantId: "tenant-a",
      role: "ADMIN",
      permissions: ["integrations.sales.manage"],
    };
    return true;
  }
}

describe("Mercado Pago connection HTTP contract", () => {
  let app: INestApplication;
  const service = {
    startOAuth: vi
      .fn()
      .mockResolvedValue({
        authorizationUrl: "https://auth.mercadopago.test/authorization",
        expiresAt: new Date(),
      }),
    connectFixedToken: vi
      .fn()
      .mockResolvedValue({
        id: "integration-a",
        provider: "MERCADO_PAGO",
        status: "ACTIVE",
        providerUserId: "123",
      }),
    disconnect: vi.fn(),
    completeOAuth: vi.fn(),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MercadoPagoConnectionController, MercadoPagoCallbackController],
      providers: [
        { provide: MercadoPagoConnectionService, useValue: service },
        {
          provide: ConfigService,
          useValue: { get: vi.fn().mockReturnValue("https://app.test/admin/orders/import") },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(TestAuthGuard)
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });
  afterAll(() => app.close());

  it("requires an authenticated administrator", () =>
    request(app.getHttpServer())
      .post("/api/admin/sales-integrations/integration-a/mercado-pago/oauth/connect")
      .send({ initialLoadDays: 30 })
      .expect(403));
  it("uses the authenticated tenant and finishes fixed-token connection without echoing the secret", async () => {
    const started = performance.now();
    const response = await request(app.getHttpServer())
      .post("/api/admin/sales-integrations/integration-a/mercado-pago/fixed-token")
      .set("Authorization", "Bearer admin")
      .send({ mode: "FIXED_TOKEN", accessToken: "APP_USR-sensitive" })
      .expect(201);
    expect(performance.now() - started).toBeLessThan(10_000);
    expect(service.connectFixedToken).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-a", integrationId: "integration-a" })
    );
    expect(JSON.stringify(response.body)).not.toContain("APP_USR-sensitive");
  });
  it.each([
    ["lost-access", 403],
    ["replayed", 409],
  ] as const)("rejects callback state %s", async (state, status) => {
    service.completeOAuth.mockRejectedValueOnce(
      status === 403 ? new ForbiddenException("rejected") : new ConflictException("rejected")
    );
    await request(app.getHttpServer())
      .get(`/api/integrations/mercadopago/callback?code=TG-code&state=${state}`)
      .expect(status);
  });
});
