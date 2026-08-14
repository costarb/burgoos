import { Controller, Get } from "@nestjs/common";
import { RuntimeRoleService } from "../config/runtime-role.service";
import { MemoryPressureService } from "../common/observability/memory-pressure.service";

@Controller("health")
export class HealthController {
  constructor(private readonly roles: RuntimeRoleService, private readonly pressure: MemoryPressureService) {}

  @Get()
  health() {
    return {
      status: "ok",
      service: "api",
      role: this.roles.role,
      pressure: this.pressure.level,
    };
  }
}
