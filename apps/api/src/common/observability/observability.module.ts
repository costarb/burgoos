import { Module } from "@nestjs/common";
import { RuntimeRoleService } from "../../config/runtime-role.service";
import { MemoryPressureService } from "./memory-pressure.service";
import { ProcessResourceMonitorService } from "./process-resource-monitor.service";
import { ResourceOperationService } from "./resource-operation.service";
import { ResourceMetricsService } from "./resource-metrics.service";

@Module({
  providers: [
    RuntimeRoleService,
    MemoryPressureService,
    ProcessResourceMonitorService,
    ResourceOperationService,
    ResourceMetricsService,
  ],
  exports: [MemoryPressureService, ResourceOperationService, ResourceMetricsService],
})
export class ObservabilityModule {}
