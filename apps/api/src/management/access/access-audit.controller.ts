import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { AuthUser } from "../../platform/auth/auth.types";
import { CurrentUser } from "../../platform/auth/current-user.decorator";
import { JwtAuthGuard } from "../../platform/auth/jwt-auth.guard";
import { AccessAuditService } from "./access-audit.service";
import { AccessAuditQueryDto } from "./dto/access-audit.dto";

@Controller("admin/access/audit")
@UseGuards(JwtAuthGuard)
export class AccessAuditController {
  constructor(@Inject(AccessAuditService) private readonly audit: AccessAuditService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: AccessAuditQueryDto) {
    return this.audit.query(user, query);
  }
}
