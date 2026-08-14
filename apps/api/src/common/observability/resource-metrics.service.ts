import { Injectable, Logger } from "@nestjs/common";
import { RuntimeRoleService } from "../../config/runtime-role.service";
import { MemoryPressureService } from "./memory-pressure.service";
import { ResourceSnapshot } from "./resource-operation.service";

@Injectable()
export class ResourceMetricsService {
  private readonly logger = new Logger(ResourceMetricsService.name);
  private activeJobs = 0;

  constructor(private readonly roles: RuntimeRoleService, private readonly pressure: MemoryPressureService) {}

  jobStarted(input: { jobId: string; handler: string; queueLagMs: number; snapshot: ResourceSnapshot }): void {
    this.activeJobs += 1;
    this.emit("background_job.started", { ...input, activeJobs: this.activeJobs });
  }

  jobFinished(input: { jobId: string; handler: string; outcome: string; durationMs: number; processedCount?: number; snapshot: ResourceSnapshot }): void {
    this.activeJobs = Math.max(0, this.activeJobs - 1);
    this.emit("background_job.finished", { ...input, activeJobs: this.activeJobs });
  }

  private emit(event: string, values: Record<string, unknown>): void {
    this.logger.log(JSON.stringify({ event, role: this.roles.role, pressureLevel: this.pressure.level, ...values }));
  }
}
