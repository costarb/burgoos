import { BadRequestException, Controller, Get, Inject, Query, Redirect } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { MercadoPagoConnectionService } from "./mercado-pago-connection.service";
import { MercadoPagoPlatformConfigurationService } from "../../../platform/integrations/mercado-pago-platform-configuration.service";

@Controller("integrations/mercadopago")
@ApiTags("Mercado Pago OAuth callback")
export class MercadoPagoCallbackController {
  constructor(
    @Inject(MercadoPagoConnectionService) private readonly service: MercadoPagoConnectionService,
    private readonly configuration: MercadoPagoPlatformConfigurationService
  ) {}

  @Get("callback")
  @Redirect()
  @ApiOperation({ summary: "Consume the one-time Mercado Pago OAuth callback" })
  async callback(@Query("code") code?: string, @Query("state") state?: string) {
    if (!code || !state) throw new BadRequestException("Code e state sao obrigatorios");
    const result = await this.service.completeOAuth(code, state);
    const configured = await this.configuration.value("postCallbackUrl");
    const target = configured
      ? new URL(configured)
      : new URL("http://localhost:3000/admin/orders/import");
    target.searchParams.set("mercadoPago", "connected");
    target.searchParams.set("integrationId", result.integrationId);
    if (result.runId) target.searchParams.set("runId", result.runId);
    return { url: target.toString(), statusCode: 302 };
  }
}
