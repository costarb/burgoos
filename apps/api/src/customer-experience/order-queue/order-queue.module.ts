import { Module } from "@nestjs/common";
import { PublicOrderQueueController } from "./public-order-queue.controller";
import { PublicOrderQueueService } from "./public-order-queue.service";

@Module({
  controllers: [PublicOrderQueueController],
  providers: [PublicOrderQueueService],
  exports: [PublicOrderQueueService],
})
export class OrderQueueModule {}
