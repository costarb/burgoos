import { ConflictException, HttpException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { PaymentInstitution } from "@prisma/client";
import { MercadoPagoAuthenticatedRequestService } from "../../management/sales-integrations/mercado-pago/mercado-pago-authenticated-request.service";
import { PrismaService } from "../../platform/database/prisma.service";
import { MercadoPagoPointClient } from "./mercado-pago-point.client";
import type { MercadoPagoTerminalOperatingMode } from "./mercado-pago-point.types";

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

  /**
   * Switches the terminal between PDV (integrated, receives charges from the system) and STANDALONE
   * (the default) through the store's Mercado Pago connection. The device applies it after a restart.
   * Leaving PDV also disables the terminal for charges.
   */
  async setOperatingMode(tenantId: string, terminalId: string, mode: MercadoPagoTerminalOperatingMode) {
    const terminal = await this.prisma.paymentTerminal.findFirst({
      where: { id: terminalId, tenantId },
    });
    if (!terminal) throw new NotFoundException("Terminal nao encontrado");
    let reported: string | undefined;
    try {
      reported = await this.authenticated.executeForTenant({
        tenantId,
        request: (accessToken) =>
          this.client.setOperatingMode(accessToken, terminal.providerTerminalId, mode),
      });
    } catch (error) {
      if (providerCode(error) === "PERMISSION_DENIED") {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_GATEWAY,
            code: "PERMISSION_DENIED",
            message:
              "O Mercado Pago nao permitiu mudar o modo desta maquininha pela API. Confira se ela esta vinculada a conta conectada, como responsavel pelo negocio, ou fale com o suporte do Mercado Pago.",
          },
          HttpStatus.BAD_GATEWAY,
        );
      }
      throw error;
    }
    const operatingMode = (reported ?? mode).toUpperCase();
    return this.prisma.paymentTerminal.update({
      where: { id: terminal.id },
      data: {
        operatingMode,
        ...(operatingMode === "PDV" ? {} : { enabled: false }),
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

function providerCode(error: unknown): string | undefined {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    return typeof response === "object" && response !== null
      ? (response as { code?: string }).code
      : undefined;
  }
  return (error as { code?: string } | null)?.code;
}

function maskSerial(serial?: string) {
  if (!serial) return null;
  return `***${serial.slice(-4)}`;
}

function providerIdentifier(value?: string | number) {
  return value === undefined || value === null ? null : String(value);
}
