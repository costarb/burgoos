import { CanActivate, ExecutionContext, INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  OperationalNotificationSeverity,
  OperationalNotificationStatus,
  UserRole,
} from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PermissionGuard } from "../src/auth/guards/permission.guard";
import { NotificationsController } from "../src/management/notifications/notifications.controller";
import { NotificationsService } from "../src/management/notifications/notifications.service";
import { AuthenticatedRequest } from "../src/platform/auth/auth.types";
import { JwtAuthGuard } from "../src/platform/auth/jwt-auth.guard";
import { FinancialManagementRolesGuard } from "../src/platform/auth/roles.guard";

const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const notificationId = "33333333-3333-4333-8333-333333333333";

class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    req.user = {
      id: userId,
      tenantId,
      role: UserRole.ADMIN,
      email: "admin@burgoos.local",
      name: "Admin",
      permissions: ["finance.view", "finance.manage"],
    };
    return true;
  }
}

describe("notifications integration", () => {
  let app: INestApplication;

  const notificationsService = {
    list: vi.fn(),
    markRead: vi.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: notificationsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(TestAuthGuard)
      .overrideGuard(FinancialManagementRolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
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
    notificationsService.list.mockResolvedValue({
      unreadCount: 1,
      items: [notification()],
    });
    notificationsService.markRead.mockResolvedValue(
      notification({ status: OperationalNotificationStatus.READ })
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  it("lists notifications for the authenticated user", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/admin/notifications?limit=50")
      .expect(200);

    expect(notificationsService.list).toHaveBeenCalledWith(tenantId, userId, { limit: 50 });
    expect(response.body.unreadCount).toBe(1);
    expect(response.body.items[0]).toEqual(expect.objectContaining({ id: notificationId }));
  });

  it("marks a notification as read for the authenticated user", async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/admin/notifications/${notificationId}/read`)
      .expect(201);

    expect(notificationsService.markRead).toHaveBeenCalledWith(tenantId, userId, notificationId);
    expect(response.body.status).toBe("READ");
  });
});

function notification(overrides: Partial<ReturnType<typeof baseNotification>> = {}) {
  return { ...baseNotification(), ...overrides };
}

function baseNotification() {
  return {
    id: notificationId,
    type: "PAYABLE_EXPORT_COMPLETED",
    status: OperationalNotificationStatus.UNREAD as OperationalNotificationStatus,
    severity: OperationalNotificationSeverity.SUCCESS as OperationalNotificationSeverity,
    title: "Exportacao concluida",
    message: "Arquivo pronto.",
    actionLabel: "Baixar arquivo",
    actionUrl: "/api/admin/exports/export-1/download",
    relatedEntityType: "export_job",
    relatedEntityId: "export-1",
    createdAt: "2026-06-30T12:00:00.000Z",
    readAt: null,
  };
}
