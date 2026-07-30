import { Controller, Get, Injectable, Param, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { FixedWindowRateLimitGuard } from "../../common/rate-limit/fixed-window-rate-limit.guard";
import { PublicOrderQueueService } from "./public-order-queue.service";

@Injectable()
class PublicOrderQueueRateLimitGuard extends FixedWindowRateLimitGuard {
  protected readonly limit = 120;
  protected readonly namespace = "public-order-queue";
}

@ApiTags("public queue")
@Controller("public")
@UseGuards(PublicOrderQueueRateLimitGuard)
export class PublicOrderQueueController {
  constructor(private readonly queues: PublicOrderQueueService) {}

  @Get("tenants/:slug/order-queue")
  @ApiOperation({ summary: "Consultar fila pública sanitizada pelo slug da loja" })
  @ApiParam({ name: "slug" })
  @ApiResponse({ status: 200, description: "Fila ativa e últimos pedidos concluídos." })
  bySlug(@Param("slug") slug: string) {
    return this.queues.bySlug(slug);
  }

  @Get("domains/:domain/order-queue")
  @ApiOperation({ summary: "Consultar fila pública sanitizada pelo domínio da loja" })
  @ApiParam({ name: "domain" })
  byDomain(@Param("domain") domain: string) {
    return this.queues.byDomain(domain);
  }
}
