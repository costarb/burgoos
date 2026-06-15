import { ConflictException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { FulfillmentMethod, OrderStatus, Prisma } from "@prisma/client";
import { OrderProfitabilityService } from "../management/reports/order-profitability.service";
import { InventoryService, OrderStockWarning } from "../operations/inventory/inventory.service";
import { PrismaService } from "../platform/database/prisma.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { calculateOrderTotals, PricedOrderItem } from "./order-calculator";
import { canTransitionOrderStatus } from "./order-status";
import { OrdersGateway } from "./orders.gateway";
import { buildWhatsAppOrderLink } from "./whatsapp-link";

@Injectable()
export class OrderingService {
  private readonly logger = new Logger(OrderingService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OrdersGateway) private readonly ordersGateway: OrdersGateway,
    @Inject(InventoryService) private readonly inventoryService: InventoryService,
    @Inject(OrderProfitabilityService)
    private readonly orderProfitabilityService: OrderProfitabilityService
  ) {}

  async createPublicOrder(slug: string, dto: CreateOrderDto) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        slug,
        active: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        phone: true,
        isOpen: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    if (!tenant.isOpen) {
      this.logger.warn(`Checkout rejected because store is closed slug=${slug}`);
      throw new ConflictException("Store is closed");
    }

    if (dto.items.length === 0) {
      this.logger.warn(`Checkout rejected because cart is empty slug=${slug}`);
      throw new ConflictException("Cart is empty");
    }

    if (dto.fulfillmentMethod === FulfillmentMethod.DELIVERY && !dto.deliveryAddress) {
      throw new ConflictException("Delivery address is required");
    }

    const requestedProductIds = [...new Set(dto.items.map((item) => item.productId))];
    const products = await this.prisma.product.findMany({
      where: {
        id: {
          in: requestedProductIds,
        },
        tenantId: tenant.id,
        active: true,
        category: {
          active: true,
        },
      },
      select: {
        id: true,
        name: true,
        price: true,
      },
    });

    if (products.length !== requestedProductIds.length) {
      this.logger.warn(`Checkout rejected because cart has stale product slug=${slug}`);
      throw new ConflictException("Cart contains unavailable products");
    }

    const productById = new Map(products.map((product) => [product.id, product]));
    const pricedItems: PricedOrderItem[] = dto.items.map((item) => {
      const product = productById.get(item.productId);

      if (!product) {
        throw new ConflictException("Cart contains unavailable products");
      }

      return {
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
      };
    });

    const calculated = calculateOrderTotals(pricedItems);

    const order = await this.prisma.order.create({
      data: {
        tenantId: tenant.id,
        total: calculated.total,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        fulfillmentMethod: dto.fulfillmentMethod,
        deliveryAddress: dto.deliveryAddress as Prisma.InputJsonValue | undefined,
        paymentMethod: dto.paymentMethod,
        paymentInstitution: dto.paymentInstitution,
        notes: dto.notes,
        items: {
          create: calculated.items.map((item) => ({
            tenantId: tenant.id,
            productId: item.productId,
            productNameSnapshot: item.productNameSnapshot,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
          })),
        },
      },
      include: {
        items: true,
        platformOrderLink: {
          include: {
            syncAttempts: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    this.logger.log(`Order created tenantId=${tenant.id} orderId=${order.id}`);
    await this.inventoryService.reserveForOrder(order);

    const response = {
      id: order.id,
      status: order.status,
      total: order.total.toFixed(2),
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      fulfillmentMethod: order.fulfillmentMethod,
      paymentMethod: order.paymentMethod,
      paymentInstitution: order.paymentInstitution,
      externalPaymentId: order.externalPaymentId,
      paymentGrossAmount: order.paymentGrossAmount?.toFixed(2) ?? null,
      paymentFeeAmount: order.paymentFeeAmount?.toFixed(2) ?? null,
      paymentNetAmount: order.paymentNetAmount?.toFixed(2) ?? null,
      paymentBrand: order.paymentBrand,
      paymentReleaseExpectedAt: order.paymentReleaseExpectedAt?.toISOString() ?? null,
      paymentReleaseSource: order.paymentReleaseSource,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productNameSnapshot: item.productNameSnapshot,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toFixed(2),
        total: item.total.toFixed(2),
      })),
      whatsappUrl: buildWhatsAppOrderLink({
        tenantPhone: tenant.phone,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        fulfillmentMethod: order.fulfillmentMethod,
        paymentMethod: order.paymentMethod,
        paymentInstitution: order.paymentInstitution,
        order: calculated,
        notes: order.notes ?? undefined,
      }),
    };

    this.ordersGateway.emitOrderCreated(tenant.id, response);

    return response;
  }

  async listAdminOrders(tenantId: string, history: boolean) {
    const terminalStatuses: OrderStatus[] = [OrderStatus.DELIVERED, OrderStatus.CANCELLED];

    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: history
          ? {
              in: terminalStatuses,
            }
          : {
              notIn: terminalStatuses,
            },
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        items: true,
        platformOrderLink: {
          include: {
            syncAttempts: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    return Promise.all(
      orders.map(async (order) =>
        this.toOrderResponse(
          order,
          history ? [] : await this.inventoryService.getOrderStockWarnings(order)
        )
      )
    );
  }

  async updateOrderStatus(tenantId: string, orderId: string, status: OrderStatus) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId,
        deletedAt: null,
      },
      include: {
        items: true,
        platformOrderLink: {
          include: {
            syncAttempts: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    if (!canTransitionOrderStatus(order.status, status)) {
      this.logger.warn(
        `Invalid order transition tenantId=${tenantId} orderId=${orderId} from=${order.status} to=${status}`
      );
      throw new ConflictException("Invalid order status transition");
    }

    const updatedOrder = await this.prisma.order.update({
      where: {
        id: orderId,
      },
      data: {
        status,
      },
      include: {
        items: true,
      },
    });

    if (status === OrderStatus.CANCELLED) {
      await this.inventoryService.releaseOrderReservation(tenantId, orderId, "Pedido cancelado");
    }

    if (status === OrderStatus.DELIVERED) {
      await this.inventoryService.consumeOrderReservation(tenantId, orderId);
      await this.orderProfitabilityService.createDeliveredOrderSnapshots(tenantId, orderId);
    }

    this.logger.log(
      `Order status changed tenantId=${tenantId} orderId=${orderId} status=${status}`
    );
    return this.toOrderResponse(
      updatedOrder,
      status === OrderStatus.CANCELLED || status === OrderStatus.DELIVERED
        ? []
        : await this.inventoryService.getOrderStockWarnings(updatedOrder)
    );
  }

  private toOrderResponse(
    order: {
      id: string;
      status: OrderStatus;
      total: Prisma.Decimal;
      customerName: string;
      customerPhone: string;
      fulfillmentMethod: string;
      paymentMethod: string;
      paymentInstitution?: string | null;
      externalPaymentId?: string | null;
      paymentGrossAmount?: Prisma.Decimal | null;
      paymentFeeAmount?: Prisma.Decimal | null;
      paymentNetAmount?: Prisma.Decimal | null;
      paymentBrand?: string | null;
      paymentReleaseExpectedAt?: Date | null;
      paymentReleaseSource?: string | null;
      orderPlatformId?: string | null;
      platformOrderLink?: {
        provider: string;
        externalOrderId: string;
        externalMerchantId: string;
        externalStatus: string;
        confirmationDeadlineAt: Date | null;
        syncAttempts?: Array<{
          status: string;
          action: string;
          errorMessage: string | null;
          createdAt: Date;
          nextRetryAt: Date | null;
        }>;
      } | null;
      notes: string | null;
      createdAt?: Date;
      updatedAt?: Date;
      deletedAt?: Date | null;
      deletionReason?: string | null;
      items: Array<{
        id: string;
        productId: string;
        productNameSnapshot: string;
        quantity: number;
        unitPrice: Prisma.Decimal;
        total: Prisma.Decimal;
      }>;
    },
    stockWarnings: OrderStockWarning[] = []
  ) {
    return {
      id: order.id,
      status: order.status,
      total: order.total.toFixed(2),
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      fulfillmentMethod: order.fulfillmentMethod,
      paymentMethod: order.paymentMethod,
      paymentInstitution: order.paymentInstitution,
      externalPaymentId: order.externalPaymentId ?? null,
      paymentGrossAmount: order.paymentGrossAmount?.toFixed(2) ?? null,
      paymentFeeAmount: order.paymentFeeAmount?.toFixed(2) ?? null,
      paymentNetAmount: order.paymentNetAmount?.toFixed(2) ?? null,
      paymentBrand: order.paymentBrand ?? null,
      paymentReleaseExpectedAt: order.paymentReleaseExpectedAt?.toISOString() ?? null,
      paymentReleaseSource: order.paymentReleaseSource ?? null,
      orderPlatformId: order.orderPlatformId ?? null,
      platformProvider: order.platformOrderLink?.provider ?? null,
      externalOrderId: order.platformOrderLink?.externalOrderId ?? null,
      externalMerchantId: order.platformOrderLink?.externalMerchantId ?? null,
      platformExternalStatus: order.platformOrderLink?.externalStatus ?? null,
      platformConfirmationDeadlineAt:
        order.platformOrderLink?.confirmationDeadlineAt?.toISOString() ?? null,
      platformConfirmationState: this.getPlatformConfirmationState(order),
      platformSyncStatus: order.platformOrderLink?.syncAttempts?.[0]?.status ?? null,
      platformSyncAction: order.platformOrderLink?.syncAttempts?.[0]?.action ?? null,
      platformSyncError: order.platformOrderLink?.syncAttempts?.[0]?.errorMessage ?? null,
      platformSyncNextRetryAt:
        order.platformOrderLink?.syncAttempts?.[0]?.nextRetryAt?.toISOString() ?? null,
      notes: order.notes,
      createdAt: order.createdAt?.toISOString(),
      updatedAt: order.updatedAt?.toISOString(),
      deletedAt: order.deletedAt?.toISOString() ?? null,
      deletionReason: order.deletionReason ?? null,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productNameSnapshot: item.productNameSnapshot,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toFixed(2),
        total: item.total.toFixed(2),
      })),
      stockWarnings,
    };
  }

  private getPlatformConfirmationState(order: {
    status: OrderStatus;
    platformOrderLink?: { confirmationDeadlineAt: Date | null } | null;
  }) {
    const deadline = order.platformOrderLink?.confirmationDeadlineAt;

    if (!deadline || order.status !== OrderStatus.PENDING) {
      return null;
    }

    const remainingMs = deadline.getTime() - Date.now();

    if (remainingMs < 0) {
      return "EXPIRED";
    }

    return remainingMs <= 2 * 60_000 ? "DUE_SOON" : "OK";
  }
}
