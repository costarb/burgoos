import { Body, Controller, Get, Inject, Param, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiConflictResponse, ApiNotFoundResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PermissionGuard } from "../../auth/guards/permission.guard";
import { RequirePermission } from "../../auth/guards/require-permission.decorator";
import { AuthUser } from "../../platform/auth/auth.types";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import { SalesCredentialDto, SalesIntegrationStatusDto, UpsertSalesIntegrationDto } from "./dto/sales-integration.dto";
import { SalesIntegrationService } from "./sales-integration.service";
import { SalesProviderRegistry } from "./sales-provider.registry";

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller("admin/sales-integrations")
@ApiTags("Sales integrations")
@ApiBearerAuth()
export class SalesIntegrationController {
  constructor(@Inject(SalesIntegrationService) private readonly service: SalesIntegrationService, @Inject(SalesProviderRegistry) private readonly registry: SalesProviderRegistry) {}
  @Get("providers") @ApiOperation({ summary: "List supported sales providers and capabilities" }) @RequirePermission("integrations.sales.view", "integrations.sales.manage") providers() { return this.registry.listCapabilities(); }
  @Get() @ApiOperation({ summary: "List tenant sales integrations without secret values" }) @RequirePermission("integrations.sales.view", "integrations.sales.manage") list(@CurrentUser() user: AuthUser) { return this.service.list(user.tenantId); }
  @Post() @ApiOperation({ summary: "Create a provider integration" }) @ApiConflictResponse({ description: "Provider integration already exists" }) @RequirePermission("integrations.sales.manage") create(@CurrentUser() user: AuthUser, @Body() dto: UpsertSalesIntegrationDto) { return this.service.create(user.tenantId, user.id, dto); }
  @Get(":id") @ApiOperation({ summary: "Get a tenant-owned sales integration" }) @ApiNotFoundResponse({ description: "Integration not found" }) @RequirePermission("integrations.sales.view", "integrations.sales.manage") get(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.service.get(user.tenantId, id); }
  @Patch(":id") @RequirePermission("integrations.sales.manage") update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpsertSalesIntegrationDto) { return this.service.update(user.tenantId, user.id, id, dto); }
  @Put(":id/credentials") @ApiOperation({ summary: "Store or rotate a write-only provider credential" }) @ApiNotFoundResponse({ description: "Integration not found" }) @RequirePermission("integrations.sales.manage") async credential(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: SalesCredentialDto) { await this.service.rotateCredential(user.tenantId, user.id, id, dto); }
  @Patch(":id/status") @ApiOperation({ summary: "Activate, pause or disable an integration" }) @ApiConflictResponse({ description: "Required configuration or credential is missing" }) @RequirePermission("integrations.sales.manage") status(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: SalesIntegrationStatusDto) { return this.service.setStatus(user.tenantId, user.id, id, dto); }
}
