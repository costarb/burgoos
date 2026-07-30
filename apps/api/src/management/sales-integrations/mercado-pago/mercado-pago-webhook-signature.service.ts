import { Injectable, UnauthorizedException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";
import { MercadoPagoPlatformConfigurationService } from "../../../platform/integrations/mercado-pago-platform-configuration.service";

@Injectable()
export class MercadoPagoWebhookSignatureService {
  constructor(private readonly configuration: MercadoPagoPlatformConfigurationService) {}

  async verify(input: {
    xSignature: string;
    xRequestId: string;
    dataId: string;
    now?: Date;
  }): Promise<{
    eventKey: string;
    timestamp: Date;
  }> {
    const parts = Object.fromEntries(
      (input.xSignature ?? "").split(",").map((part) => part.trim().split("=", 2))
    ) as Record<string, string>;
    if (!parts.ts || !parts.v1 || !/^\d+$/.test(parts.ts) || !input.xRequestId || !input.dataId)
      throw new UnauthorizedException("Assinatura Mercado Pago invalida");
    const timestamp = new Date(Number(parts.ts) * 1000);
    const now = input.now ?? new Date();
    if (
      !Number.isFinite(timestamp.getTime()) ||
      Math.abs(now.getTime() - timestamp.getTime()) > 5 * 60_000
    )
      throw new UnauthorizedException("Assinatura Mercado Pago expirada");
    const secret = await this.configuration.value("webhookSecret");
    if (!secret) throw new UnauthorizedException("Webhook Mercado Pago nao configurado");
    const manifest = `id:${input.dataId};request-id:${input.xRequestId};ts:${parts.ts};`;
    const expected = createHmac("sha256", secret).update(manifest).digest("hex");
    const received = Buffer.from(parts.v1, "hex");
    const calculated = Buffer.from(expected, "hex");
    if (received.length !== calculated.length || !timingSafeEqual(received, calculated))
      throw new UnauthorizedException("Assinatura Mercado Pago invalida");
    const eventKey = createHmac("sha256", secret)
      .update(`${input.xRequestId}:${input.dataId}:${parts.ts}`)
      .digest("hex");
    return { eventKey, timestamp };
  }
}
