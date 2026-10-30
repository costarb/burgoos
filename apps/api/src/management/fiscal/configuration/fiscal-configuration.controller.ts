import { Body, Controller, Get, Inject, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PermissionGuard } from "../../../auth/guards/permission.guard";
import { RequirePermission } from "../../../auth/guards/require-permission.decorator";
import { AuthUser } from "../../../platform/auth/auth.types";
import { CurrentUser } from "../../../platform/auth/current-user.decorator";
import { JwtAuthGuard } from "../../../platform/auth/jwt-auth.guard";
import { FISCAL_PERMISSIONS } from "../fiscal-permissions";
import { UpdateFiscalConfigurationDto, UpdateFiscalIssuerDto } from "./dto/fiscal-configuration.dto";
import { FiscalConfigurationService } from "./fiscal-configuration.service";
import { FiscalIssuerService } from "./fiscal-issuer.service";

@ApiTags("admin fiscal")
@ApiBearerAuth()
@Controller("admin/fiscal")
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission(FISCAL_PERMISSIONS.configure)
export class FiscalConfigurationController {
  constructor(
    @Inject(FiscalConfigurationService) private readonly configuration: FiscalConfigurationService,
    @Inject(FiscalIssuerService) private readonly issuers: FiscalIssuerService
  ) {}

  @Get("configuration")
  @RequirePermission(FISCAL_PERMISSIONS.view, FISCAL_PERMISSIONS.configure)
  get(@CurrentUser() user: AuthUser) {
    return this.configuration.get(user.tenantId);
  }

  @Put("configuration")
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateFiscalConfigurationDto) {
    return this.configuration.update(user, dto);
  }

  @Put("issuer")
  async updateIssuer(@CurrentUser() user: AuthUser, @Body() dto: UpdateFiscalIssuerDto) {
    await this.issuers.update(user, dto);
    return this.configuration.get(user.tenantId);
  }
}
