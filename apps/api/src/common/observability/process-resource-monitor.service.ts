import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { RuntimeRoleService } from "../../config/runtime-role.service";
import { MemoryPressureService } from "./memory-pressure.service";
import { snapshot } from "./resource-operation.service";

@Injectable()
export class ProcessResourceMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProcessResourceMonitorService.name);
  private timer?: NodeJS.Timeout;
  private readonly eventLoop = monitorEventLoopDelay({ resolution: 20 });

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(RuntimeRoleService) private readonly roles: RuntimeRoleService,
    @Inject(MemoryPressureService) private readonly pressure: MemoryPressureService
  ) {}

  onModuleInit(): void {
    this.eventLoop.enable();
    const intervalMs = this.config.get<number>("MEMORY_SAMPLE_INTERVAL_MS") ?? 30_000;
    this.sample();
    this.timer = setInterval(() => this.sample(), intervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.eventLoop.disable();
  }

  sample(): void {
    const memory = snapshot();
    const previous = this.pressure.level;
    const level = this.pressure.observe(memory.rss);
    const payload = {
      event: "resource.process.sample",
      role: this.roles.role,
      level,
      ...memory,
      eventLoopLagP99Ms: Number(this.eventLoop.percentile(99) / 1_000_000),
    };
    if (level !== previous || memory.rss >= this.pressure.peakBytes) {
      this.logger.warn(JSON.stringify(payload));
    } else {
      this.logger.log(JSON.stringify(payload));
    }
    this.eventLoop.reset();
  }
}
