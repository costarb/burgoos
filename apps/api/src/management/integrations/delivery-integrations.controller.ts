import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { PermissionGuard } from "../../auth/guards/permission.guard";
import { RequirePermission } from "../../auth/guards/require-permission.decorator";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { AuthUser } from "../../platform/auth/auth.types";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import { DeliveryIntegrationHealthService } from "./delivery-integration-health.service";
import { DeliveryIntegrationsService } from "./delivery-integrations.service";
import {
  DeliveryCredentialDto,
  DeliveryIntegrationDto,
  DeliveryIntegrationUpdateDto,
} from "./dto/delivery-integration.dto";

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller("admin/integrations/delivery")
export class DeliveryIntegrationsController {
  constructor(
    @Inject(DeliveryIntegrationsService)
    private readonly integrationsService: DeliveryIntegrationsService,
    @Inject(DeliveryIntegrationHealthService)
    private readonly healthService: DeliveryIntegrationHealthService
  ) {}

  @Get()
  @RequirePermission("integrations.delivery.view", "integrations.delivery.manage")
  list(@CurrentUser() user: AuthUser) {
    return this.integrationsService.list(user.tenantId);
  }

  @Post()
  @RequirePermission("integrations.delivery.manage")
  create(@CurrentUser() user: AuthUser, @Body() dto: DeliveryIntegrationDto) {
    return this.integrationsService.create(user.tenantId, user.id, dto);
  }

  @Get(":id")
  @RequirePermission("integrations.delivery.view", "integrations.delivery.manage")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.integrationsService.getDetail(user.tenantId, id);
  }

  @Patch(":id")
  @RequirePermission("integrations.delivery.manage")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: DeliveryIntegrationUpdateDto
  ) {
    return this.integrationsService.update(user.tenantId, user.id, id, dto);
  }

  @Post(":id/credentials")
  @RequirePermission("integrations.delivery.manage")
  async saveCredentials(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: DeliveryCredentialDto
  ) {
    await this.integrationsService.saveCredentials(user.tenantId, user.id, id, dto);
  }

  @Post(":id/validate")
  @RequirePermission("integrations.delivery.manage")
  validate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.integrationsService.validate(user.tenantId, user.id, id);
  }

  @Post(":id/activate")
  @RequirePermission("integrations.delivery.manage")
  activate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.integrationsService.activate(user.tenantId, user.id, id);
  }

  @Post(":id/pause")
  @RequirePermission("integrations.delivery.manage")
  pause(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.integrationsService.pause(user.tenantId, user.id, id);
  }

  @Get(":id/health")
  @RequirePermission("integrations.delivery.view", "integrations.delivery.manage")
  health(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.healthService.getHealth(user.tenantId, id);
  }
}
