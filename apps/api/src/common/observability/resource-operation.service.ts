import { Injectable, Logger } from "@nestjs/common";
import { currentResourceCorrelation, ResourceCorrelation } from "./resource-correlation";

export interface ResourceSnapshot {
  rss: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
}

@Injectable()
export class ResourceOperationService {
  private readonly logger = new Logger(ResourceOperationService.name);

  start(correlation: ResourceCorrelation = { operation: "unspecified" }): ResourceOperation {
    const startedAt = Date.now();
    const start = snapshot();
    this.logger.log(JSON.stringify({ event: "resource.operation.start", ...correlation, ...start }));
    return {
      finish: (outcome = "success", processedCount?: number) => {
        const end = snapshot();
        this.logger.log(
          JSON.stringify({
            event: "resource.operation.finish",
            ...(currentResourceCorrelation() ?? correlation),
            outcome,
            processedCount,
            durationMs: Date.now() - startedAt,
            start,
            end,
          })
        );
        return { start, end, durationMs: Date.now() - startedAt };
      },
    };
  }
}

export interface ResourceOperation {
  finish(
    outcome?: string,
    processedCount?: number
  ): { start: ResourceSnapshot; end: ResourceSnapshot; durationMs: number };
}

export function snapshot(): ResourceSnapshot {
  const memory = process.memoryUsage();
  return {
    rss: memory.rss,
    heapUsed: memory.heapUsed,
    heapTotal: memory.heapTotal,
    external: memory.external,
    arrayBuffers: memory.arrayBuffers,
  };
}
