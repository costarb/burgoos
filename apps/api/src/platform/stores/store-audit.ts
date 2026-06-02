import { Logger } from "@nestjs/common";

export type StoreAuditAction =
  | "STORE_CREATED"
  | "STORE_UPDATED"
  | "STORE_ACTIVATED"
  | "STORE_DEACTIVATED"
  | "BRANDING_DRAFT_SAVED"
  | "BRANDING_PUBLISHED"
  | "BRANDING_RESTORED";

export interface StoreAuditEvent {
  action: StoreAuditAction;
  tenantId?: string;
  platformUserId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

const logger = new Logger("StoreAudit");

export function logStoreAuditEvent(event: StoreAuditEvent): void {
  logger.log(
    JSON.stringify({
      ...event,
      occurredAt: new Date().toISOString(),
    })
  );
}
