import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PlatformAdminGuard, PlatformAuthUser } from "../auth/platform-admin.guard";
import { CreateStoreDto, UpdateStoreDto } from "./dto/store-onboarding.dto";
import { PlatformStoreService } from "./platform-store.service";

@ApiTags("platform stores")
@ApiBearerAuth()
@Controller("platform/stores")
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformStoreController {
  constructor(@Inject(PlatformStoreService) private readonly service: PlatformStoreService) {}

  @Get()
  list(@Query("search") search?: string, @Query("active") active?: string) {
    return this.service.list({
      search: search?.trim() || undefined,
      active: active === undefined || active === "" ? undefined : active === "true",
    });
  }

  @Post()
  create(@CurrentUser() user: PlatformAuthUser, @Body() dto: CreateStoreDto) {
    return this.service.create(dto, user.id);
  }

  @Get(":storeId")
  get(@Param("storeId") storeId: string) {
    return this.service.get(storeId);
  }

  @Patch(":storeId")
  update(
    @CurrentUser() user: PlatformAuthUser,
    @Param("storeId") storeId: string,
    @Body() dto: UpdateStoreDto
  ) {
    return this.service.update(storeId, dto, user.id);
  }

  @Get(":storeId/readiness")
  readiness(@Param("storeId") storeId: string) {
    return this.service.readiness(storeId);
  }
}
