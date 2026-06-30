import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  record(event: string, details: Record<string, unknown>): void {
    this.logger.log(`${event} ${JSON.stringify(details)}`);
  }
}
