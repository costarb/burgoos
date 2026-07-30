import {
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  FulfillmentMethod,
  OrderSource,
  OrderStatus,
  Prisma,
  VisualConfigurationStatus,
} from "@prisma/client";
import { IfoodStatusSyncService } from "../management/integrations/ifood/ifood-status-sync.service";
import { OrderProfitabilityService } from "../management/reports/order-profitability.service";
import { InventoryService, OrderStockWarning } from "../operations/inventory/inventory.service";
import { PrismaService } from "../platform/database/prisma.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { calculateOrderTotals, PricedOrderItem } from "./order-calculator";
import { canTransitionOrderStatus } from "./order-status";
import { OrdersGateway } from "./orders.gateway";
import { nextOrderPublicCode } from "./order-public-code";
import { buildWhatsAppOrderLink } from "./whatsapp-link";

@Injectable()
export class OrderingService {
  private readonly logger = new Logger(OrderingService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OrdersGateway) private readonly ordersGateway: OrdersGateway,
    @Inject(InventoryService) private readonly inventoryService: InventoryService,
    @Inject(OrderProfitabilityService)
    private readonly orderProfitabilityService: OrderProfitabilityService,
    @Inject(forwardRef(() => IfoodStatusSyncService))
    private readonly ifoodStatusSyncService: IfoodStatusSyncService
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

    const storeVisualConfiguration = (
      this.prisma as PrismaService & {
        storeVisualConfiguration?: PrismaService["storeVisualConfiguration"];
      }
    ).storeVisualConfiguration;
    const menuConfiguration = storeVisualConfiguration
      ? await storeVisualConfiguration.findFirst({
          where: {
            tenantId: tenant.id,
            status: VisualConfigurationStatus.PUBLISHED,
          },
          orderBy: {
            publishedAt: "desc",
          },
          select: {
            orderingEnabled: true,
          },
        })
      : null;

    if (menuConfiguration?.orderingEnabled === false) {
      this.logger.warn(`Checkout rejected because ordering is disabled slug=${slug}`);
      throw new ConflictException("Online ordering is disabled");
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
    const publicCode = await nextOrderPublicCode(this.prisma, tenant.id);

    const order = await this.prisma.order.create({
      data: {
        tenantId: tenant.id,
        source: OrderSource.PUBLIC_MENU,
        publicCode,
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
        items: { include: { modifications: true } },
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
        items: { include: { modifications: true } },
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

  async updateOrderStatus(
    tenantId: string,
    orderId: string,
    status: OrderStatus,
    actorUserId?: string,
    expectedVersion?: number,
  ) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId,
        deletedAt: null,
      },
      include: {
        items: { include: { modifications: true } },
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

    if (expectedVersion !== undefined && order.version !== expectedVersion) {
      throw new ConflictException("Pedido foi alterado por outro operador. Recarregue a tela");
    }

    if (!canTransitionOrderStatus(order.status, status, order.fulfillmentMethod)) {
      this.logger.warn(
        `Invalid order transition tenantId=${tenantId} orderId=${orderId} from=${order.status} to=${status}`
      );
      throw new ConflictException("Invalid order status transition");
    }

    const changedAt = new Date();
    const statusData = {
      status,
      version: { increment: 1 },
      ...(status === OrderStatus.PREPARING && !order.productionStartedAt
        ? { productionStartedAt: changedAt }
        : {}),
      ...(status === OrderStatus.READY ? { readyAt: changedAt } : {}),
      ...(status === OrderStatus.DELIVERED || status === OrderStatus.CANCELLED
        ? { completedAt: changedAt }
        : {}),
    };

    let updatedOrder;
    if (expectedVersion === undefined) {
      updatedOrder = await this.prisma.order.update({
        where: {
          id: orderId,
        },
        data: statusData,
        include: {
          items: { include: { modifications: true } },
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
    } else {
      const claimed = await this.prisma.order.updateMany({
        where: { id: orderId, tenantId, version: expectedVersion, deletedAt: null },
        data: statusData,
      });
      if (claimed.count !== 1) {
        throw new ConflictException("Pedido foi alterado por outro operador. Recarregue a tela");
      }
      updatedOrder = order;
    }

    if (order.platformOrderLink?.provider === "IFOOD") {
      await this.ifoodStatusSyncService.syncInternalStatus({
        tenantId,
        actorUserId,
        link: order.platformOrderLink,
        status,
      });
    }

    if (status === OrderStatus.CANCELLED) {
      await this.inventoryService.releaseOrderReservation(tenantId, orderId, "Pedido cancelado");
    }

    if (status === OrderStatus.DELIVERED) {
      await this.inventoryService.consumeOrderReservation(tenantId, orderId);
      await this.orderProfitabilityService.createDeliveredOrderSnapshots(tenantId, orderId);
    }

    const orderDelegate = this.prisma.order as PrismaService["order"] & {
      findUnique?: PrismaService["order"]["findUnique"];
    };
    const responseOrder = orderDelegate.findUnique
      ? await orderDelegate.findUnique({
          where: { id: orderId },
          include: {
            items: { include: { modifications: true } },
            platformOrderLink: {
              include: {
                syncAttempts: {
                  orderBy: { createdAt: "desc" },
                  take: 1,
                },
              },
            },
          },
        })
      : null;

    this.logger.log(
      `Order status changed tenantId=${tenantId} orderId=${orderId} status=${status}`
    );
    const response = this.toOrderResponse(
      responseOrder ?? updatedOrder,
      status === OrderStatus.CANCELLED || status === OrderStatus.DELIVERED
        ? []
        : await this.inventoryService.getOrderStockWarnings(responseOrder ?? updatedOrder)
    );
    this.ordersGateway.emitOrderUpdated(tenantId, response);
    return response;
  }

  private toOrderResponse(
    order: {
      id: string;
      source: string;
      publicCode: string | null;
      version: number;
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
        modifications: Array<{
          id: string;
          type: "REMOVE_INGREDIENT" | "ADD_COMPLEMENT";
          nameSnapshot: string;
          quantity: Prisma.Decimal;
          unitPriceDelta: Prisma.Decimal;
          totalPriceDelta: Prisma.Decimal;
        }>;
      }>;
    },
    stockWarnings: OrderStockWarning[] = []
  ) {
    return {
      id: order.id,
      source: order.source,
      publicCode: order.publicCode,
      version: order.version,
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
        modifications: item.modifications.map((modification) => ({
          id: modification.id,
          type: modification.type,
          nameSnapshot: modification.nameSnapshot,
          quantity: modification.quantity.toNumber(),
          unitPriceDelta: modification.unitPriceDelta.toFixed(2),
          totalPriceDelta: modification.totalPriceDelta.toFixed(2),
        })),
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
