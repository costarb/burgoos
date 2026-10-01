import { Module } from "@nestjs/common";
import { BackgroundJobsModule } from "../../common/background-jobs/background-jobs.module";
import { ObservabilityModule } from "../../common/observability/observability.module";
import { OperationsModule } from "../../operations/operations.module";
import { AuthModule } from "../../platform/auth/auth.module";
import { ManagementModule } from "../management.module";

@Module({
  imports: [AuthModule, ManagementModule, OperationsModule, ObservabilityModule, BackgroundJobsModule],
  controllers: [],
  providers: [],
})
export class McpModule {}
