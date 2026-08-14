import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type AppRole = "api" | "worker" | "all";

@Injectable()
export class RuntimeRoleService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  get role(): AppRole {
    return (this.config.get<AppRole>("APP_ROLE") ?? "all") as AppRole;
  }

  get servesHttp(): boolean {
    return this.role !== "worker";
  }

  get consumesBackgroundJobs(): boolean {
    return this.role !== "api";
  }
}
