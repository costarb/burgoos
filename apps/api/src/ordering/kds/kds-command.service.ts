import { Injectable, Logger } from "@nestjs/common";
import {
  OperationalEventSource,
  OperationalEventType,
  OrderStatus,
} from "@prisma/client";
import { AuthUser } from "../../platform/auth/auth.types";
import { OrderingService } from "../ordering.service";
import { OperationalEventService } from "../operational-events/operational-event.service";
import { KdsQueryService } from "./kds-query.service";
import { UpdateKdsOrderStatusDto } from "./dto/update-kds-order-status.dto";

@Injectable()
export class KdsCommandService {
  private readonly logger = new Logger(KdsCommandService.name);
  constructor(
    private readonly ordering: OrderingService,
    private readonly query: KdsQueryService,
    private readonly events: OperationalEventService,
  ) {}

  async updateStatus(user: AuthUser, orderId: string, dto: UpdateKdsOrderStatusDto) {
    await this.ordering.updateOrderStatus(
      user.tenantId,
      orderId,
      dto.status,
      user.id,
      dto.expectedVersion,
    );
    await this.events.record({
      tenantId: user.tenantId,
      orderId,
      actorUserId: user.id,
      source: OperationalEventSource.USER,
      type:
        dto.status === OrderStatus.CANCELLED
          ? OperationalEventType.ORDER_CANCELLED
          : OperationalEventType.ORDER_STATUS_CHANGED,
      reason: dto.reason?.trim() || null,
      metadata: { status: dto.status },
    });
    this.logger.log(
      `event=kds.order.status_changed metric=kds_status_transitions value=1 tenantId=${user.tenantId} orderId=${orderId} status=${dto.status}`,
    );
    return this.query.findOne(user.tenantId, orderId);
  }
}
