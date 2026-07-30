import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  OperationalEventSource,
  OperationalEventType,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  Prisma,
  ServiceTabStatus,
} from "@prisma/client";
import { randomInt } from "node:crypto";
import { AuthUser } from "../../platform/auth/auth.types";
import { PrismaService } from "../../platform/database/prisma.service";
import { OperationalEventService } from "../operational-events/operational-event.service";
import { OrdersGateway } from "../orders.gateway";
import {
  CreateCounterOrderDto,
  UpdateCounterOrderDto,
} from "./dto/create-counter-order.dto";
import {
  CounterOrderCalculator,
  CounterProductPricing,
} from "./counter-order-calculator";

@Injectable()
export class CounterOrderService {
  private readonly logger = new Logger(CounterOrderService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: CounterOrderCalculator,
    private readonly events: OperationalEventService,
    private readonly gateway: OrdersGateway,
  ) {}

  async create(user: AuthUser, dto: CreateCounterOrderDto) {
    const tenantId = user.tenantId;
    if (dto.serviceTabId) {
      const tab = await this.prisma.serviceTab.findFirst({
        where: { id: dto.serviceTabId, tenantId },
        select: { status: true },
      });
      if (!tab) throw new UnprocessableEntityException("Comanda nao encontrada");
      if (tab.status !== ServiceTabStatus.OPEN) {
        throw new ConflictException("Comanda nao aceita novos pedidos");
      }
    }

    const productIds = [...new Set(dto.items.map((item) => item.productId))];
    const products = await this.loadProducts(tenantId, productIds);
    if (products.size !== productIds.length) {
      throw new UnprocessableEntityException("Pedido contem produto indisponivel");
    }

    const calculated = this.calculator.calculate(dto.items, products, this.authorization(user));
    const publicCode = await this.nextPublicCode(tenantId);

    const order = await this.prisma.order.create({
      data: {
        tenantId,
        source: OrderSource.COUNTER,
        publicCode,
        serviceTabId: dto.serviceTabId,
        total: calculated.total,
        customerName: dto.customerName?.trim() || "Balcao",
        customerPhone: dto.customerPhone?.trim() || "",
        fulfillmentMethod: dto.fulfillmentMethod,
        paymentMethod: PaymentMethod.CASH,
        notes: dto.notes?.trim() || null,
        items: {
          create: calculated.items.map((item) => ({
            tenantId,
            productId: item.productId,
            productNameSnapshot: item.productNameSnapshot,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            baseUnitPrice: item.baseUnitPrice,
            calculatedUnitPrice: item.calculatedUnitPrice,
            chargedUnitPrice: item.chargedUnitPrice,
            manualAdjustmentAmount: item.manualAdjustmentAmount,
            manualAdjustmentReason: item.manualAdjustmentReason,
            manualAdjustmentByUserId: item.manualAdjustmentByUserId,
            notes: item.notes,
            modifications: {
              create: item.modifications.map((modification) => ({
                tenantId,
                ...modification,
              })),
            },
          })),
        },
      },
      include: { items: { include: { modifications: true } } },
    });

    await this.events.record({
      tenantId,
      orderId: order.id,
      actorUserId: user.id,
      type: OperationalEventType.ORDER_CREATED,
      source: OperationalEventSource.USER,
      metadata: {
        orderSource: OrderSource.COUNTER,
        releaseToKds: dto.releaseToKds ?? true,
      },
    });
    for (const item of calculated.items.filter((candidate) => candidate.manualAdjustmentReason)) {
      await this.events.record({
        tenantId,
        orderId: order.id,
        actorUserId: user.id,
        type: OperationalEventType.PRICE_OVERRIDDEN,
        source: OperationalEventSource.USER,
        reason: item.manualAdjustmentReason,
        metadata: {
          productId: item.productId,
          calculatedUnitPrice: item.calculatedUnitPrice.toFixed(2),
          chargedUnitPrice: item.chargedUnitPrice.toFixed(2),
        },
      });
    }

    this.gateway.emitOrderCreated(tenantId, order);
    this.logger.log(
      `event=pos.order.created metric=pos_orders_created value=1 tenantId=${tenantId} orderId=${order.id} tabId=${order.serviceTabId ?? "none"} itemCount=${order.items.length}`,
    );
    return this.toResponse(order);
  }

  async findOne(user: AuthUser, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId: user.tenantId,
        source: OrderSource.COUNTER,
        deletedAt: null,
      },
      include: { items: { include: { modifications: true } } },
    });
    if (!order) {
      throw new NotFoundException("Pedido de balcao nao encontrado");
    }
    return this.toResponse(order);
  }

  async pendingPayment(tenantId: string) {
    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        source: OrderSource.COUNTER,
        serviceTabId: null,
        deletedAt: null,
        status: { not: OrderStatus.CANCELLED },
      },
      include: {
        items: {
          select: {
            id: true,
            productNameSnapshot: true,
            quantity: true,
            notes: true,
            modifications: {
              select: {
                id: true,
                type: true,
                nameSnapshot: true,
                quantity: true,
              },
            },
          },
        },
        paymentAllocations: {
          where: {
            payment: { cancelledAt: null, refundedAt: null },
          },
          select: { amount: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const assigneeIds = [
      ...new Set(orders.flatMap((order) => order.assignedUserId ? [order.assignedUserId] : [])),
    ];
    const assignees = assigneeIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: assigneeIds } },
          select: { id: true, name: true },
        })
      : [];
    const assigneeNames = new Map(assignees.map((candidate) => [candidate.id, candidate.name]));

    return orders.flatMap((order) => {
      const paid = order.paymentAllocations.reduce(
        (sum, allocation) => sum.add(allocation.amount),
        new Prisma.Decimal(0),
      );
      const balance = order.total.sub(paid);
      if (balance.lessThanOrEqualTo(0)) return [];
      return [{
        id: order.id,
        publicCode: order.publicCode ?? order.id.slice(0, 8).toUpperCase(),
        customerName: order.customerName || null,
        status: order.status,
        total: order.total.toFixed(2),
        paidAmount: paid.toFixed(2),
        openBalance: balance.toFixed(2),
        createdAt: order.createdAt.toISOString(),
        items: order.items.map((item) => ({
          id: item.id,
          productName: item.productNameSnapshot,
          quantity: item.quantity,
          notes: item.notes,
          modifications: item.modifications.map((modification) => ({
            id: modification.id,
            type: modification.type,
            name: modification.nameSnapshot,
            quantity: modification.quantity.toNumber(),
          })),
        })),
        assignment: order.assignedUserId
          ? {
              userId: order.assignedUserId,
              userName: assigneeNames.get(order.assignedUserId) ?? "Usuario indisponivel",
              assignedAt: order.updatedAt.toISOString(),
            }
          : null,
      }];
    });
  }

  async update(user: AuthUser, orderId: string, dto: UpdateCounterOrderDto) {
    const tenantId = user.tenantId;
    const current = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId,
        source: OrderSource.COUNTER,
        deletedAt: null,
      },
      select: { id: true, status: true, version: true },
    });
    if (!current) {
      throw new NotFoundException("Pedido de balcao nao encontrado");
    }
    if (
      current.status !== OrderStatus.PENDING &&
      current.status !== OrderStatus.PREPARING
    ) {
      throw new ConflictException("Somente pedidos novos ou em preparo podem ser alterados");
    }
    if (current.version !== dto.expectedVersion) {
      throw new ConflictException("Pedido foi alterado por outro operador. Recarregue a tela");
    }

    const productIds = [...new Set(dto.items.map((item) => item.productId))];
    const products = await this.loadProducts(tenantId, productIds);
    if (products.size !== productIds.length) {
      throw new UnprocessableEntityException("Pedido contem produto indisponivel");
    }
    const calculated = this.calculator.calculate(dto.items, products, this.authorization(user));

    const order = await this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.order.updateMany({
        where: {
          id: orderId,
          tenantId,
          version: dto.expectedVersion,
          status: { in: [OrderStatus.PENDING, OrderStatus.PREPARING] },
          deletedAt: null,
        },
        data: {
          version: { increment: 1 },
          total: calculated.total,
          customerName: dto.customerName?.trim() || "Balcao",
          customerPhone: dto.customerPhone?.trim() || "",
          fulfillmentMethod: dto.fulfillmentMethod,
          notes: dto.notes?.trim() || null,
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException("Pedido foi alterado por outro operador. Recarregue a tela");
      }

      await transaction.orderItem.deleteMany({ where: { orderId, tenantId } });
      return transaction.order.update({
        where: { id: orderId },
        data: {
          items: {
            create: calculated.items.map((item) => ({
              tenantId,
              productId: item.productId,
              productNameSnapshot: item.productNameSnapshot,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
              baseUnitPrice: item.baseUnitPrice,
              calculatedUnitPrice: item.calculatedUnitPrice,
              chargedUnitPrice: item.chargedUnitPrice,
              manualAdjustmentAmount: item.manualAdjustmentAmount,
              manualAdjustmentReason: item.manualAdjustmentReason,
              manualAdjustmentByUserId: item.manualAdjustmentByUserId,
              notes: item.notes,
              modifications: {
                create: item.modifications.map((modification) => ({
                  tenantId,
                  ...modification,
                })),
              },
            })),
          },
        },
        include: { items: { include: { modifications: true } } },
      });
    });

    const response = this.toResponse(order);
    this.gateway.emitOrderUpdated(tenantId, response);
    return response;
  }

  private async loadProducts(tenantId: string, productIds: string[]) {
    const rows = await this.prisma.product.findMany({
      where: {
        tenantId,
        id: { in: productIds },
        active: true,
        category: { tenantId, active: true },
      },
      include: {
        technicalSheets: {
          where: { tenantId, active: true },
          take: 1,
          include: {
            lines: {
              where: { isPackaging: false },
              include: { ingredient: { select: { id: true, name: true } } },
            },
          },
        },
        complementAssignments: {
          where: { active: true, complement: { tenantId, active: true } },
          include: { complement: true },
        },
      },
    });
    return new Map<string, CounterProductPricing>(
      rows.map((product) => [
        product.id,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          removableIngredients: (product.technicalSheets[0]?.lines ?? []).map((line) => ({
            id: line.ingredient.id,
            name: line.ingredient.name,
          })),
          complements: product.complementAssignments.map((assignment) => ({
            id: assignment.complement.id,
            name: assignment.complement.name,
            price: assignment.complement.price,
            maxQuantity: Math.min(
              assignment.maxQuantity,
              assignment.complement.maxQuantity,
            ),
          })),
        },
      ]),
    );
  }

  private authorization(user: AuthUser) {
    return {
      actorUserId: user.id,
      canOverridePrice:
        Boolean(user.isMaster) ||
        user.role === "OWNER" ||
        user.role === "ADMIN" ||
        Boolean(user.permissions?.includes("pos.override-price")),
    };
  }

  private async nextPublicCode(tenantId: string): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = String(randomInt(1, 1000)).padStart(3, "0");
      const exists = await this.prisma.order.count({
        where: {
          tenantId,
          publicCode: code,
          createdAt: { gte: startOfUtcDay(new Date()) },
        },
      });
      if (!exists) return code;
    }
    throw new ConflictException("Nao foi possivel gerar o codigo do pedido");
  }

  private toResponse(order: Prisma.OrderGetPayload<{
    include: { items: { include: { modifications: true } } };
  }>) {
    return {
      id: order.id,
      publicCode: order.publicCode,
      serviceTabId: order.serviceTabId,
      source: order.source,
      status: order.status,
      paymentStatus: "UNPAID" as const,
      fulfillmentMethod: order.fulfillmentMethod,
      total: order.total.toFixed(2),
      customerName: order.customerName || null,
      customerPhone: order.customerPhone || null,
      assignedUserId: order.assignedUserId,
      version: order.version,
      notes: order.notes,
      createdAt: order.createdAt.toISOString(),
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productNameSnapshot: item.productNameSnapshot,
        quantity: item.quantity,
        baseUnitPrice: (item.baseUnitPrice ?? item.unitPrice).toFixed(2),
        calculatedUnitPrice: (item.calculatedUnitPrice ?? item.unitPrice).toFixed(2),
        chargedUnitPrice: (item.chargedUnitPrice ?? item.unitPrice).toFixed(2),
        total: item.total.toFixed(2),
        manualAdjustmentAmount: (item.manualAdjustmentAmount ?? new Prisma.Decimal(0)).toFixed(2),
        manualAdjustmentReason: item.manualAdjustmentReason,
        notes: item.notes,
        modifications: item.modifications.map((modification) => ({
          id: modification.id,
          type: modification.type,
          referenceId: modification.ingredientId ?? modification.complementId!,
          nameSnapshot: modification.nameSnapshot,
          quantity: modification.quantity.toNumber(),
          unitPriceDelta: modification.unitPriceDelta.toFixed(2),
          totalPriceDelta: modification.totalPriceDelta.toFixed(2),
        })),
      })),
    };
  }
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
