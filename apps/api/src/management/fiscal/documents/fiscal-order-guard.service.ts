import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../platform/database/prisma.service";

const LOCKING_STATUSES = ["PENDING", "PROCESSING", "AUTHORIZED", "ERROR"] as const;

/**
 * Items and values of a sale with an NFC-e being issued or authorized cannot change (FR-021):
 * the note would no longer match the sale. Cancelling or deleting stays allowed and cancels it.
 */
@Injectable()
export class FiscalOrderGuardService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async assertMutable(tenantId: string, orderId: string): Promise<void> {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, tenantId }, select: { serviceTabId: true } });
    if (!order) return;
    const keys = [`order:${orderId}`, ...(order.serviceTabId ? [`tab:${order.serviceTabId}`] : [])];
    const document = await this.prisma.fiscalDocument.findFirst({
      where: { tenantId, activeKey: { in: keys }, status: { in: [...LOCKING_STATUSES] } },
      select: { id: true, number: true, status: true },
    });
    if (document) {
      throw new ConflictException({
        code: "FISCAL_DOCUMENT_ACTIVE",
        message: "Pedido com NFC-e emitida nao pode ser alterado. Cancele a venda e lance novamente.",
        documentId: document.id,
      });
    }
  }
}
