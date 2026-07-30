import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Injectable,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";
import { MercadoPagoWebhookSignatureService } from "../../management/sales-integrations/mercado-pago/mercado-pago-webhook-signature.service";
import { PaymentProviderEventProcessor } from "./payment-provider-event.processor";
import { FixedWindowRateLimitGuard } from "../../common/rate-limit/fixed-window-rate-limit.guard";

@Injectable()
class MercadoPagoOrdersWebhookRateLimitGuard extends FixedWindowRateLimitGuard {
  protected readonly limit = 300;
  protected readonly namespace = "mercado-pago-orders-webhook";
}

interface OrdersWebhookPayload {
  id?: string | number;
  type?: string;
  action?: string;
  user_id?: string | number;
  data?: { id?: string | number };
}

@ApiTags("payments")
@Controller("webhooks/mercadopago/orders")
@UseGuards(MercadoPagoOrdersWebhookRateLimitGuard)
export class MercadoPagoOrdersWebhookController {
  constructor(
    private readonly signatures: MercadoPagoWebhookSignatureService,
    private readonly events: PaymentProviderEventProcessor,
  ) {}

  @Post()
  @ApiOperation({ summary: "Receber notificação assinada da Orders API Mercado Pago" })
  @ApiHeader({ name: "x-signature", required: true })
  @ApiHeader({ name: "x-request-id", required: true })
  @ApiResponse({ status: 200, description: "Evento validado e persistido idempotentemente." })
  @ApiResponse({ status: 401, description: "Assinatura inválida." })
  async receive(
    @Headers("x-signature") signature: string,
    @Headers("x-request-id") requestId: string,
    @Query("data.id") queryDataId: string | undefined,
    @Body() payload: OrdersWebhookPayload,
  ) {
    const resourceId = queryDataId ?? (payload.data?.id == null ? "" : String(payload.data.id));
    if (!resourceId || !["order", "orders"].includes(payload.type ?? "")) {
      throw new BadRequestException("Notificacao Orders invalida");
    }
    const verified = await this.signatures.verify({
      xSignature: signature,
      xRequestId: requestId,
      dataId: resourceId,
    });
    return this.events.accept({
      eventId: payload.id == null ? verified.eventKey : String(payload.id),
      resourceId,
      topic: payload.action ?? payload.type ?? "order",
      payload: {
        type: payload.type ?? "order",
        action: payload.action ?? null,
        user_id: payload.user_id == null ? null : String(payload.user_id),
        data: { id: resourceId },
      } as Prisma.InputJsonObject,
    });
  }
}
