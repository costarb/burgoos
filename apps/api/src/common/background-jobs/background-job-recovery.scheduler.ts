import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { RuntimeRoleService } from "../../config/runtime-role.service";
import { BackgroundJobRepository } from "./background-job.repository";

@Injectable()
export class BackgroundJobRecoveryScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackgroundJobRecoveryScheduler.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly repository: BackgroundJobRepository,
    private readonly role: RuntimeRoleService,
    private readonly config: ConfigService
  ) {}

  onModuleInit(): void {
    if (!this.role.consumesBackgroundJobs) return;
    const interval = this.config.get<number>("BACKGROUND_JOB_LEASE_MS") ?? 60_000;
    this.timer = setInterval(() => {
      void this.repository.recoverExpiredLeases().catch((error) =>
        this.logger.error("background_job.recovery_failed", error)
      );
    }, interval);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
