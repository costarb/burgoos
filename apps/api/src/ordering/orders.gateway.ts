import { Inject, Logger } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { AuthService } from "../platform/auth/auth.service";

@WebSocketGateway({
  cors: {
    origin: "*"
  }
})
export class OrdersGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server?: Server;

  private readonly logger = new Logger(OrdersGateway.name);

  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = String(client.handshake.auth.token ?? "").replace(/^Bearer\s+/i, "");
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const user = await this.authService.verifyAccessToken(token);
      const permissions = user.permissions ?? [];
      const authorized =
        !user.isPlatformAdmin &&
        (Boolean(user.isMaster) ||
          user.role === UserRole.OWNER ||
          user.role === UserRole.ADMIN ||
          permissions.includes("kds.view") ||
          permissions.includes("kds.manage") ||
          permissions.includes("orders.view") ||
          permissions.includes("orders.manage"));
      if (!authorized) {
        client.disconnect(true);
        return;
      }
      client.data.tenantId = user.tenantId;
      await client.join(this.roomForTenant(user.tenantId));
    } catch {
      this.logger.warn(`Rejected unauthenticated realtime connection socketId=${client.id}`);
      client.disconnect(true);
    }
  }

  emitOrderCreated(tenantId: string, order: unknown): void {
    this.logger.log(`Emitting order-created tenantId=${tenantId}`);
    this.server?.to(this.roomForTenant(tenantId)).emit("order-created", order);
  }

  emitOrderUpdated(tenantId: string, order: unknown): void {
    this.logger.log(`Emitting order-updated tenantId=${tenantId}`);
    this.server?.to(this.roomForTenant(tenantId)).emit("order-updated", order);
  }

  private roomForTenant(tenantId: string): string {
    return `tenant:${tenantId}`;
  }
}
