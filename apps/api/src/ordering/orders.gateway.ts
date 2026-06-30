import { Logger } from "@nestjs/common";
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

@WebSocketGateway({
  cors: {
    origin: "*"
  }
})
export class OrdersGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server?: Server;

  private readonly logger = new Logger(OrdersGateway.name);

  handleConnection(client: Socket): void {
    const tenantId = String(client.handshake.auth.tenantId ?? client.handshake.query.tenantId ?? "");

    if (tenantId) {
      client.join(this.roomForTenant(tenantId));
    }
  }

  emitOrderCreated(tenantId: string, order: unknown): void {
    this.logger.log(`Emitting order-created tenantId=${tenantId}`);
    this.server?.to(this.roomForTenant(tenantId)).emit("order-created", order);
  }

  private roomForTenant(tenantId: string): string {
    return `tenant:${tenantId}`;
  }
}
