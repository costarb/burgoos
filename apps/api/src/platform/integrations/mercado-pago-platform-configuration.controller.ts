import { Body, Controller, Get, Inject, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PlatformAdminGuard, PlatformAuthUser } from "../auth/platform-admin.guard";
import { UpdateMercadoPagoPlatformConfigurationDto } from "./dto/mercado-pago-platform-configuration.dto";
import { MercadoPagoPlatformConfigurationService } from "./mercado-pago-platform-configuration.service";

@ApiTags("platform integrations")
@ApiBearerAuth()
@Controller("platform/integrations/mercado-pago/configuration")
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class MercadoPagoPlatformConfigurationController {
  constructor(
    @Inject(MercadoPagoPlatformConfigurationService)
    private readonly service: MercadoPagoPlatformConfigurationService
  ) {}

  @Get()
  get() {
    return this.service.safeView();
  }

  @Put()
  update(
    @CurrentUser() user: PlatformAuthUser,
    @Body() dto: UpdateMercadoPagoPlatformConfigurationDto
  ) {
    return this.service.update(dto, user.id);
  }
}
