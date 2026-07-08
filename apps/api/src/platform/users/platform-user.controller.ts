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
import { PlatformUserRole } from "@prisma/client";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PlatformAdminGuard, PlatformAuthUser } from "../auth/platform-admin.guard";
import { CreatePlatformUserDto, UpdatePlatformUserDto } from "./dto/platform-user.dto";
import { PlatformUserService } from "./platform-user.service";

@ApiTags("platform users")
@ApiBearerAuth()
@Controller("platform/users")
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformUserController {
  constructor(@Inject(PlatformUserService) private readonly service: PlatformUserService) {}

  @Get()
  list(
    @Query("search") search?: string,
    @Query("active") active?: string,
    @Query("role") role?: string
  ) {
    return this.service.list({
      search: search?.trim() || undefined,
      active: active === undefined || active === "" ? undefined : active === "true",
      role: role === "SUPER_ADMIN" || role === "SUPPORT" ? (role as PlatformUserRole) : undefined,
    });
  }

  @Post()
  create(@Body() dto: CreatePlatformUserDto) {
    return this.service.create(dto);
  }

  @Patch(":userId")
  update(
    @CurrentUser() user: PlatformAuthUser,
    @Param("userId") userId: string,
    @Body() dto: UpdatePlatformUserDto
  ) {
    return this.service.update(userId, dto, user.id);
  }
}
