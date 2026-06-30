import { Body, Controller, Inject, Param, Post } from "@nestjs/common";
import { CreateOrderDto } from "./dto/create-order.dto";
import { OrderingService } from "./ordering.service";

@Controller("public/tenants/:slug/orders")
export class PublicOrderController {
  constructor(@Inject(OrderingService) private readonly orderingService: OrderingService) {}

  @Post()
  create(@Param("slug") slug: string, @Body() dto: CreateOrderDto) {
    return this.orderingService.createPublicOrder(slug, dto);
  }
}
