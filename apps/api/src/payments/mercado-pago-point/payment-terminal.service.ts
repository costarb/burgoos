import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PaymentInstitution } from "@prisma/client";
import { MercadoPagoAuthenticatedRequestService } from "../../management/sales-integrations/mercado-pago/mercado-pago-authenticated-request.service";
import { PrismaService } from "../../platform/database/prisma.service";
import { MercadoPagoPointClient } from "./mercado-pago-point.client";

@Injectable()
export class PaymentTerminalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authenticated: MercadoPagoAuthenticatedRequestService,
    private readonly client: MercadoPagoPointClient,
  ) {}

  list(tenantId: string) {
    return this.prisma.paymentTerminal.findMany({
      where: { tenantId },
      orderBy: [{ enabled: "desc" }, { displayName: "asc" }],
    });
  }

  async synchronize(tenantId: string) {
    return this.authenticated.executeForTenant({
      tenantId,
      request: async (accessToken, context) => {
        const terminals = await this.client.listTerminals(accessToken);
        const synchronized = [];
        for (const terminal of terminals) {
          const operatingMode = terminal.operating_mode?.toUpperCase() ?? null;
          synchronized.push(await this.prisma.paymentTerminal.upsert({
            where: {
              connectionId_providerTerminalId: {
                connectionId: context.integrationId,
                providerTerminalId: terminal.id,
              },
            },
            create: {
              tenantId,
              connectionId: context.integrationId,
              provider: PaymentInstitution.MERCADO_PAGO,
              providerTerminalId: terminal.id,
              providerStoreId: providerIdentifier(terminal.store_id),
              providerPosId: providerIdentifier(terminal.pos_id),
              model: terminal.model ?? null,
              serialNumberMasked: maskSerial(terminal.serial_number),
              operatingMode,
              displayName: terminal.model
                ? `${terminal.model} - ${terminal.id.slice(-6)}`
                : `Point ${terminal.id.slice(-6)}`,
              enabled: false,
              lastSeenAt: new Date(),
            },
            update: {
              providerStoreId: providerIdentifier(terminal.store_id),
              providerPosId: providerIdentifier(terminal.pos_id),
              model: terminal.model ?? null,
              serialNumberMasked: maskSerial(terminal.serial_number),
              operatingMode,
              enabled: operatingMode === "PDV" ? undefined : false,
              lastSeenAt: new Date(),
            },
          }));
        }
        return synchronized;
      },
    });
  }

  async setEnabled(tenantId: string, terminalId: string, enabled: boolean) {
    const terminal = await this.prisma.paymentTerminal.findFirst({
      where: { id: terminalId, tenantId },
    });
    if (!terminal) throw new NotFoundException("Terminal nao encontrado");
    if (enabled && terminal.operatingMode?.toUpperCase() !== "PDV") {
      throw new ConflictException("Configure a maquininha em modo PDV antes de habilita-la");
    }
    return this.prisma.paymentTerminal.update({
      where: { id: terminal.id },
      data: { enabled },
    });
  }
}

function maskSerial(serial?: string) {
  if (!serial) return null;
  return `***${serial.slice(-4)}`;
}

function providerIdentifier(value?: string | number) {
  return value === undefined || value === null ? null : String(value);
}
