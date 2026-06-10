import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthUser } from "../../../platform/auth/auth.types";
import { CurrentUser } from "../../../platform/auth/current-user.decorator";
import { JwtAuthGuard } from "../../../platform/auth/jwt-auth.guard";
import {
  AccessProfileDto,
  AccessProfilesQueryDto,
  AccessProfileUpdateDto,
} from "../dto/access-profile.dto";
import { AccessProfilesService } from "./access-profiles.service";

@Controller("admin/access/profiles")
@UseGuards(JwtAuthGuard)
export class AccessProfilesController {
  constructor(private readonly profiles: AccessProfilesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: AccessProfilesQueryDto) {
    return this.profiles.list(user, query);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: AccessProfileDto) {
    return this.profiles.create(user, dto);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.profiles.get(user, id);
  }

  @Post(":id/duplicate")
  duplicate(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: { name: string; storeId?: string | null }
  ) {
    return this.profiles.duplicate(user, id, dto.name, dto.storeId);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: AccessProfileUpdateDto
  ) {
    return this.profiles.update(user, id, dto);
  }
}
