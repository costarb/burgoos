import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { AuthUser } from "../../platform/auth/auth.types";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import { OrderPlatformDto } from "./dto/order-platform.dto";
import { OrderPlatformService } from "./order-platform.service";

@ApiTags("admin order platforms")
@ApiBearerAuth()
@Controller("admin/order-platforms")
@UseGuards(JwtAuthGuard)
export class OrderPlatformController {
  constructor(@Inject(OrderPlatformService) private readonly service: OrderPlatformService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.tenantId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: OrderPlatformDto) {
    return this.service.create(user.tenantId, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: OrderPlatformDto) {
    return this.service.update(user.tenantId, id, dto);
  }
}
