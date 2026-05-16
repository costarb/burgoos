import { Module } from "@nestjs/common";
import { AuthModule } from "../platform/auth/auth.module";
import { OperationsModule } from "../operations/operations.module";
import { DatabaseModule } from "../platform/database/database.module";
import { AdminOrderController } from "./admin-order.controller";
import { OrdersGateway } from "./orders.gateway";
import { OrderingService } from "./ordering.service";
import { PublicOrderController } from "./public-order.controller";

@Module({
  imports: [DatabaseModule, AuthModule, OperationsModule],
  controllers: [PublicOrderController, AdminOrderController],
  providers: [OrderingService, OrdersGateway],
})
export class OrderingModule {}
