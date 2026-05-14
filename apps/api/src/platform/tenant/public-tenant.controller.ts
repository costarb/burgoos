import { Controller, Get, Inject, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { TenantContextService, TenantSummary } from "./tenant-context.service";

@ApiTags("public tenant")
@Controller("public/tenants")
export class PublicTenantController {
  constructor(@Inject(TenantContextService) private readonly tenantContext: TenantContextService) {}

  @Get(":slug")
  async getPublicTenant(@Param("slug") slug: string): Promise<TenantSummary> {
    return this.tenantContext.resolvePublicTenant(slug);
  }
}
