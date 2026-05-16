import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { AuthUser } from "../../platform/auth/auth.types";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import { ProductPricingService } from "./product-pricing.service";

@ApiTags("admin pricing")
@ApiBearerAuth()
@Controller("admin/pricing/products")
@UseGuards(JwtAuthGuard)
export class PricingController {
  constructor(@Inject(ProductPricingService) private readonly service: ProductPricingService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query("platformId") platformId?: string) {
    return this.service.list(user.tenantId, platformId);
  }
}
