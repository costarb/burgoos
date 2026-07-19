import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Inject,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { MercadoPagoWebhookPayload } from "./mercado-pago.types";
import { MercadoPagoWebhookSignatureService } from "./mercado-pago-webhook-signature.service";
import { MercadoPagoWebhookService } from "./mercado-pago-webhook.service";

@Controller("webhooks/mercadopago")
@ApiTags("Mercado Pago webhook")
export class MercadoPagoWebhookController {
  constructor(
    @Inject(MercadoPagoWebhookSignatureService)
    private readonly signatures: MercadoPagoWebhookSignatureService,
    @Inject(MercadoPagoWebhookService) private readonly webhooks: MercadoPagoWebhookService
  ) {}
  @Post()
  @ApiOperation({ summary: "Accept a signed Mercado Pago notification" })
  async receive(
    @Headers("x-signature") xSignature: string,
    @Headers("x-request-id") xRequestId: string,
    @Query("data.id") queryDataId: string | undefined,
    @Body() payload: MercadoPagoWebhookPayload
  ) {
    if (
      !payload?.data?.id ||
      !["payment", "order", "topic_claims_integration_wh", "topic_chargebacks_wh"].includes(
        payload.type
      )
    )
      throw new BadRequestException("Notificacao Mercado Pago invalida");
    const dataId = queryDataId ?? String(payload.data.id);
    const verified = await this.signatures.verify({ xSignature, xRequestId, dataId });
    return this.webhooks.accept({ eventKey: verified.eventKey, payload });
  }
}
