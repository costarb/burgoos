export type BackgroundJobType =
  | "EXPORT"
  | "SALES_IMPORT_PREVIEW"
  | "SALES_IMPORT_CONFIRM"
  | "PROVIDER_WEBHOOK"
  | "PAYMENT_WEBHOOK"
  | "IFOOD_POLL"
  | "MP_RECONCILIATION"
  | "MP_TOKEN_REFRESH"
  | "POINT_RECONCILIATION"
  | "RETENTION";

export type BackgroundJobPriority = "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
export type BackgroundJobStatus =
  | "PENDING"
  | "RUNNING"
  | "RETRY_WAIT"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED";

export interface BackgroundJobRoute<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  type: BackgroundJobType;
  tenantId: string | null;
  targetType: string;
  targetId: string;
  payload: TPayload;
}

export interface BackgroundJobLease extends BackgroundJobRoute {
  id: string;
  priority: BackgroundJobPriority;
  attempts: number;
  maxAttempts: number;
  leasedBy: string;
  leaseVersion: number;
  leaseExpiresAt: string;
}

export interface BackgroundJobHandler<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  readonly type: BackgroundJobType;
  execute(job: BackgroundJobLease & { payload: TPayload }, signal: AbortSignal): Promise<{ processedCount?: number }>;
}
