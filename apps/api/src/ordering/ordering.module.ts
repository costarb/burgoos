import { Module } from "@nestjs/common";
import { ManagementModule } from "../management/management.module";
import { AuthModule } from "../platform/auth/auth.module";
import { OperationsModule } from "../operations/operations.module";
import { DatabaseModule } from "../platform/database/database.module";
import { AdminOrderController } from "./admin-order.controller";
import { HistoricalOrderImportService } from "./historical-order-import.service";
import { OrdersGateway } from "./orders.gateway";
import { OrderingService } from "./ordering.service";
import { OrderMaintenanceService } from "./order-maintenance.service";
import { PublicOrderController } from "./public-order.controller";

@Module({
  imports: [DatabaseModule, AuthModule, OperationsModule, ManagementModule],
  controllers: [PublicOrderController, AdminOrderController],
  providers: [OrderingService, OrdersGateway, HistoricalOrderImportService, OrderMaintenanceService],
})
export class OrderingModule {}
