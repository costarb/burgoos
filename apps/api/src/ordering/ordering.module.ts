import { forwardRef, Module } from "@nestjs/common";
import { ManagementModule } from "../management/management.module";
import { AuthModule } from "../platform/auth/auth.module";
import { OperationsModule } from "../operations/operations.module";
import { DatabaseModule } from "../platform/database/database.module";
import { AdminOrderController } from "./admin-order.controller";
import { ExternalOrderIngestionService } from "./external-order-ingestion.service";
import { HistoricalOrderImportService } from "./historical-order-import.service";
import { OrdersGateway } from "./orders.gateway";
import { OrderingService } from "./ordering.service";
import { OrderMaintenanceService } from "./order-maintenance.service";
import { PublicOrderController } from "./public-order.controller";
import { OperationalEventService } from "./operational-events/operational-event.service";
import { CounterCatalogService } from "./counter-sales/counter-catalog.service";
import { CounterOrderCalculator } from "./counter-sales/counter-order-calculator";
import { CounterOrderService } from "./counter-sales/counter-order.service";
import { CounterSalesController } from "./counter-sales/counter-sales.controller";
import { IdempotencyModule } from "../common/idempotency/idempotency.module";
import { ServiceTabController } from "./tabs/service-tab.controller";
import { ServiceTabService } from "./tabs/service-tab.service";
import { KdsController } from "./kds/kds.controller";
import { KdsCommandService } from "./kds/kds-command.service";
import { KdsQueryService } from "./kds/kds-query.service";
import { OperationalAssignmentController } from "./assignments/operational-assignment.controller";
import { OperationalAssignmentService } from "./assignments/operational-assignment.service";
import { ShiftCloseService } from "./shift-close/shift-close.service";
import { ShiftCloseController } from "./shift-close/shift-close.controller";

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    IdempotencyModule,
    OperationsModule,
    forwardRef(() => ManagementModule),
  ],
  controllers: [
    PublicOrderController,
    AdminOrderController,
    CounterSalesController,
    ServiceTabController,
    KdsController,
    OperationalAssignmentController,
    ShiftCloseController,
  ],
  providers: [
    OrderingService,
    OrdersGateway,
    HistoricalOrderImportService,
    OrderMaintenanceService,
    ExternalOrderIngestionService,
    OperationalEventService,
    CounterCatalogService,
    CounterOrderCalculator,
    CounterOrderService,
    ServiceTabService,
    KdsQueryService,
    KdsCommandService,
    OperationalAssignmentService,
    ShiftCloseService,
  ],
  exports: [ExternalOrderIngestionService, HistoricalOrderImportService, OperationalEventService],
})
export class OrderingModule {}
