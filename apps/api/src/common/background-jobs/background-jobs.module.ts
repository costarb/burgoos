import { Module } from "@nestjs/common";
import { RuntimeRoleService } from "../../config/runtime-role.service";
import { ObservabilityModule } from "../observability/observability.module";
import { BackgroundJobPolicy } from "./background-job-policy";
import { BackgroundJobRecoveryScheduler } from "./background-job-recovery.scheduler";
import { BackgroundJobRegistry } from "./background-job.registry";
import { BackgroundJobRepository } from "./background-job.repository";
import { BackgroundJobService } from "./background-job.service";
import { BackgroundJobWorker } from "./background-job.worker";

@Module({
  imports: [ObservabilityModule],
  providers: [
    RuntimeRoleService,
    BackgroundJobPolicy,
    BackgroundJobRecoveryScheduler,
    BackgroundJobRegistry,
    BackgroundJobRepository,
    BackgroundJobService,
    BackgroundJobWorker,
  ],
  exports: [BackgroundJobRegistry, BackgroundJobService, RuntimeRoleService],
})
export class BackgroundJobsModule {}
