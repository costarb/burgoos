import { Body, Controller, Get, Inject, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PlatformAdminGuard, PlatformAuthUser } from "../auth/platform-admin.guard";
import { UpdatePagBankPlatformConfigurationDto } from "./dto/pagbank-platform-configuration.dto";
import { PagBankPlatformConfigurationService } from "./pagbank-platform-configuration.service";

@ApiTags("platform integrations")
@ApiBearerAuth()
@Controller("platform/integrations/pagbank/configuration")
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PagBankPlatformConfigurationController {
  constructor(
    @Inject(PagBankPlatformConfigurationService)
    private readonly service: PagBankPlatformConfigurationService
  ) {}

  @Get()
  get() {
    return this.service.safeView();
  }

  @Put()
  update(
    @CurrentUser() user: PlatformAuthUser,
    @Body() dto: UpdatePagBankPlatformConfigurationDto
  ) {
    return this.service.update(dto, user.id);
  }
}
