import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AuthUser } from "../auth/auth.types";
import { TenantContextService, TenantSummary } from "./tenant-context.service";

@ApiTags("admin tenant")
@ApiBearerAuth()
@Controller("admin/tenant")
export class AdminTenantController {
  constructor(@Inject(TenantContextService) private readonly tenantContext: TenantContextService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getCurrentTenant(@CurrentUser() user: AuthUser): Promise<TenantSummary> {
    return this.tenantContext.resolveAdminTenant(user.tenantId);
  }
}
