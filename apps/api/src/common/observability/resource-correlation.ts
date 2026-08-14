import { AsyncLocalStorage } from "node:async_hooks";

export interface ResourceCorrelation {
  operation: string;
  correlationId?: string;
  tenantId?: string;
  jobId?: string;
  handler?: string;
}

const storage = new AsyncLocalStorage<ResourceCorrelation>();

export function withResourceCorrelation<T>(
  correlation: ResourceCorrelation,
  callback: () => T
): T {
  return storage.run(sanitizeCorrelation(correlation), callback);
}

export function currentResourceCorrelation(): ResourceCorrelation | undefined {
  return storage.getStore();
}

function sanitizeCorrelation(value: ResourceCorrelation): ResourceCorrelation {
  return {
    operation: bounded(value.operation),
    correlationId: optionalBounded(value.correlationId),
    tenantId: optionalBounded(value.tenantId),
    jobId: optionalBounded(value.jobId),
    handler: optionalBounded(value.handler),
  };
}

function optionalBounded(value: string | undefined): string | undefined {
  return value ? bounded(value) : undefined;
}

function bounded(value: string): string {
  return value.replace(/[\r\n\t]/g, " ").slice(0, 128);
}
