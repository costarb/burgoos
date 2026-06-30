import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../platform/database/prisma.service";
import { OrdersGateway } from "./orders.gateway";
import { ExternalOrderDraft, ExternalOrderItemDraft } from "./external-order.types";

@Injectable()
export class ExternalOrderIngestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersGateway: OrdersGateway
  ) {}

  async ingest(input: {
    tenantId: string;
    integrationId: string;
    orderPlatformId: string;
    order: ExternalOrderDraft;
  }) {
    const existingLink = await this.prisma.platformOrderLink.findUnique({
      where: {
        provider_externalMerchantId_externalOrderId: {
          provider: input.order.provider,
          externalMerchantId: input.order.externalMerchantId,
          externalOrderId: input.order.externalOrderId,
        },
      },
      include: {
        order: {
          include: { items: true },
        },
      },
    });

    if (existingLink) {
      return existingLink.order;
    }

    const products = await Promise.all(
      input.order.items.map((item) => this.ensureExternalProduct(input.tenantId, item))
    );

    const createdOrder = await this.prisma.order.create({
      data: {
        tenantId: input.tenantId,
        status: "PENDING",
        total: new Prisma.Decimal(input.order.total),
        customerName: input.order.customerName,
        customerPhone: input.order.customerPhone ?? "Nao informado",
        fulfillmentMethod: input.order.fulfillmentMethod,
        deliveryAddress: input.order.deliveryAddress as Prisma.InputJsonValue | undefined,
        paymentMethod: input.order.paymentMethod,
        orderPlatformId: input.orderPlatformId,
        notes: input.order.notes,
        items: {
          create: input.order.items.map((item, index) => ({
            tenantId: input.tenantId,
            productId: products[index].id,
            productNameSnapshot: item.notes ? `${item.name} (${item.notes})` : item.name,
            quantity: item.quantity,
            unitPrice: new Prisma.Decimal(item.unitPrice),
            total: new Prisma.Decimal(item.total),
          })),
        },
        platformOrderLink: {
          create: {
            tenantId: input.tenantId,
            integrationId: input.integrationId,
            orderPlatformId: input.orderPlatformId,
            provider: input.order.provider,
            externalMerchantId: input.order.externalMerchantId,
            externalOrderId: input.order.externalOrderId,
            mode: input.order.mode,
            timing: input.order.timing,
            externalStatus: input.order.externalStatus,
            confirmationDeadlineAt: input.order.confirmationDeadlineAt,
            preparationStartAt: input.order.preparationStartAt,
            rawOrderSnapshot: input.order.rawOrder as Prisma.InputJsonValue,
          },
        },
      },
      include: {
        items: true,
      },
    });

    this.ordersGateway.emitOrderCreated(input.tenantId, {
      id: createdOrder.id,
      status: createdOrder.status,
      total: createdOrder.total.toFixed(2),
      customerName: createdOrder.customerName,
      customerPhone: createdOrder.customerPhone,
      fulfillmentMethod: createdOrder.fulfillmentMethod,
      paymentMethod: createdOrder.paymentMethod,
      paymentInstitution: createdOrder.paymentInstitution,
      orderPlatformId: createdOrder.orderPlatformId,
      platformProvider: input.order.provider,
      externalOrderId: input.order.externalOrderId,
      externalMerchantId: input.order.externalMerchantId,
      platformExternalStatus: input.order.externalStatus,
      platformConfirmationDeadlineAt: input.order.confirmationDeadlineAt?.toISOString() ?? null,
      notes: createdOrder.notes,
      createdAt: createdOrder.createdAt.toISOString(),
      updatedAt: createdOrder.updatedAt.toISOString(),
      deletedAt: null,
      deletionReason: null,
      items: createdOrder.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productNameSnapshot: item.productNameSnapshot,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toFixed(2),
        total: item.total.toFixed(2),
      })),
      stockWarnings: [],
    });

    return createdOrder;
  }

  private async ensureExternalProduct(tenantId: string, item: ExternalOrderItemDraft) {
    const productName = `iFood - ${item.name}`;
    const existing = await this.prisma.product.findFirst({
      where: {
        tenantId,
        name: productName,
      },
      select: { id: true },
    });

    if (existing) {
      return existing;
    }

    const category = await this.ensureExternalCategory(tenantId);

    return this.prisma.product.create({
      data: {
        tenantId,
        categoryId: category.id,
        name: productName,
        description: "Produto criado automaticamente para pedido importado do iFood.",
        price: new Prisma.Decimal(item.unitPrice),
        active: false,
      },
      select: { id: true },
    });
  }

  private async ensureExternalCategory(tenantId: string) {
    const existing = await this.prisma.category.findFirst({
      where: {
        tenantId,
        name: "Delivery externo",
      },
      select: { id: true },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.category.create({
      data: {
        tenantId,
        name: "Delivery externo",
        sortOrder: 999,
        active: false,
      },
      select: { id: true },
    });
  }
}
