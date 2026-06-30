import { Module } from "@nestjs/common";
import { AuthModule } from "../platform/auth/auth.module";
import { DatabaseModule } from "../platform/database/database.module";
import { InventoryController } from "./inventory/inventory.controller";
import { InventoryService } from "./inventory/inventory.service";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class OperationsModule {}
