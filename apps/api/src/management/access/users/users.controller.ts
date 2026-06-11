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
import { AuthUser } from "../../../platform/auth/auth.types";
import { CurrentUser } from "../../../platform/auth/current-user.decorator";
import { JwtAuthGuard } from "../../../platform/auth/jwt-auth.guard";
import { AccessUserDto, AccessUsersQueryDto, AccessUserUpdateDto } from "../dto/user-access.dto";
import { UsersService } from "./users.service";

@Controller("admin/access/users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: AccessUsersQueryDto) {
    return this.users.list(user, query);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: AccessUserDto) {
    return this.users.create(user, dto);
  }

  @Get("options")
  options(@CurrentUser() user: AuthUser) {
    return this.users.options(user);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.users.get(user, id);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: AccessUserUpdateDto) {
    return this.users.update(user, id, dto);
  }

  @Post(":id/first-access")
  issueFirstAccess(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.users.issueFirstAccess(user, id);
  }
}
