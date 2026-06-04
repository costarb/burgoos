import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { OrderMaintenanceAction, OrderStatus, Prisma } from "@prisma/client";
import { OrderProfitabilityService } from "../management/reports/order-profitability.service";
import { InventoryService } from "../operations/inventory/inventory.service";
import { AuthUser } from "../platform/auth/auth.types";
import { PrismaService } from "../platform/database/prisma.service";
import { DeleteOrderDto } from "./dto/delete-order.dto";
import { EditOrderDto } from "./dto/edit-order.dto";
import { OrderMaintenanceQueryDto } from "./dto/order-maintenance-query.dto";
import { assertOrderVersion, validateOrderMaintenanceInput } from "./order-maintenance-validation";

type MaintainableOrder = Prisma.OrderGetPayload<{ include: { items: true } }>;

@Injectable()
export class OrderMaintenanceService {
  private readonly logger = new Logger(OrderMaintenanceService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(InventoryService) private readonly inventoryService: InventoryService,
    @Inject(OrderProfitabilityService)
    private readonly profitabilityService: OrderProfitabilityService
  ) {}

  async edit(user: AuthUser, orderId: string, dto: EditOrderDto) {
    const current = await this.getOrder(user.tenantId, orderId);
    this.assertCurrent(current, dto.expectedUpdatedAt);
    validateOrderMaintenanceInput(current.status, dto);
    await this.validateProducts(user.tenantId, dto.items.map((item) => item.productId));

    const beforeSnapshot = jsonSnapshot(current);
    const total = dto.items.reduce(
      (sum, item) => sum.add(new Prisma.Decimal(item.unitPrice).mul(item.quantity)),
      new Prisma.Decimal(0)
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      await lockOrderVersion(tx, user.tenantId, orderId, dto.expectedUpdatedAt);
      const inventoryReleases = await this.inventoryService.neutralizeOrderEffect(
        user.tenantId,
        orderId,
        "Correcao de pedido: neutralizar efeito anterior",
        tx
      );

      if (current.status === OrderStatus.DELIVERED) {
        await tx.orderProfitabilitySnapshot.deleteMany({ where: { tenantId: user.tenantId, orderId } });
      }

      await tx.orderItem.deleteMany({ where: { tenantId: user.tenantId, orderId } });
      await tx.orderItem.createMany({
        data: dto.items.map((item) => ({
          tenantId: user.tenantId,
          orderId,
          productId: item.productId,
          productNameSnapshot: item.productNameSnapshot,
          quantity: item.quantity,
          unitPrice: new Prisma.Decimal(item.unitPrice),
          total: new Prisma.Decimal(item.unitPrice).mul(item.quantity),
        })),
      });

      const order = await tx.order.update({
        where: { id: orderId },
        data: {
          total,
          customerName: dto.customerName.trim(),
          customerPhone: dto.customerPhone.trim(),
          fulfillmentMethod: dto.fulfillmentMethod,
          deliveryAddress: dto.deliveryAddress as Prisma.InputJsonValue | undefined,
          notes: dto.notes?.trim() || null,
          createdAt: new Date(dto.createdAt),
          paymentMethod: dto.paymentMethod,
          paymentInstitution: dto.paymentInstitution ?? null,
          externalPaymentId: dto.externalPaymentId?.trim() || null,
          paymentGrossAmount: decimal(dto.paymentGrossAmount),
          paymentFeeAmount: decimal(dto.paymentFeeAmount),
          paymentNetAmount: decimal(dto.paymentNetAmount),
          paymentBrand: dto.paymentBrand?.trim() || null,
          paymentReleaseExpectedAt: dto.paymentReleaseExpectedAt
            ? new Date(dto.paymentReleaseExpectedAt)
            : null,
          orderPlatformId: dto.orderPlatformId ?? null,
        },
        include: { items: true },
      });

      const inventoryApplications = await this.inventoryService.applyOrderEffect(
        user.tenantId,
        orderId,
        current.status,
        tx
      );

      if (current.status === OrderStatus.DELIVERED) {
        await this.profitabilityService.createDeliveredOrderSnapshots(user.tenantId, orderId, tx);
      }

      await tx.orderMaintenance.create({
        data: {
          tenantId: user.tenantId,
          orderId,
          actorUserId: user.id,
          action: OrderMaintenanceAction.EDIT,
          reason: dto.reason?.trim() || "Correcao operacional",
          expectedUpdatedAt: new Date(dto.expectedUpdatedAt),
          beforeSnapshot,
          afterSnapshot: jsonSnapshot(order),
          impactSummary: { inventoryReleases, inventoryApplications, status: current.status },
        },
      });

      return order;
    });

    this.logger.log(
      `Order edited tenantId=${user.tenantId} orderId=${orderId} actorUserId=${user.id}`
    );
    return toResponse(updated);
  }

  async remove(user: AuthUser, orderId: string, dto: DeleteOrderDto) {
    const current = await this.getOrder(user.tenantId, orderId);
    this.assertCurrent(current, dto.expectedUpdatedAt);
    const deletedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await lockOrderVersion(tx, user.tenantId, orderId, dto.expectedUpdatedAt);
      const inventoryReleases = await this.inventoryService.neutralizeOrderEffect(
        user.tenantId,
        orderId,
        "Pedido excluido: compensar efeito",
        tx
      );
      await tx.orderProfitabilitySnapshot.deleteMany({ where: { tenantId: user.tenantId, orderId } });
      await tx.order.update({
        where: { id: orderId },
        data: { deletedAt, deletedByUserId: user.id, deletionReason: dto.reason.trim() },
      });
      await tx.orderMaintenance.create({
        data: {
          tenantId: user.tenantId,
          orderId,
          actorUserId: user.id,
          action: OrderMaintenanceAction.DELETE,
          reason: dto.reason.trim(),
          expectedUpdatedAt: new Date(dto.expectedUpdatedAt),
          beforeSnapshot: jsonSnapshot(current),
          afterSnapshot: Prisma.JsonNull,
          impactSummary: { inventoryReleases, status: current.status },
        },
      });
    });

    this.logger.log(`Order deleted tenantId=${user.tenantId} orderId=${orderId} actorUserId=${user.id}`);
    return { orderId, deletedAt: deletedAt.toISOString(), reason: dto.reason.trim() };
  }

  async search(tenantId: string, query: OrderMaintenanceQueryDto) {
    const search = query.search?.trim();
    const searchFilters: Prisma.OrderWhereInput[] | undefined = search
      ? [
          ...(isUuid(search) ? [{ id: search }] : []),
          { externalPaymentId: { contains: search, mode: "insensitive" } },
          { customerName: { contains: search, mode: "insensitive" } },
          { customerPhone: { contains: search, mode: "insensitive" } },
        ]
      : undefined;
    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        deletedAt: query.includeDeleted === "true" ? undefined : null,
        status: query.status,
        createdAt: {
          gte: query.start ? new Date(`${query.start}T00:00:00`) : undefined,
          lte: query.end ? new Date(`${query.end}T23:59:59.999`) : undefined,
        },
        OR: searchFilters,
      },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
    return orders.map(toResponse);
  }

  async history(tenantId: string, orderId: string) {
    await this.getOrder(tenantId, orderId, true);
    const records = await this.prisma.orderMaintenance.findMany({
      where: { tenantId, orderId },
      include: { actorUser: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return records.map((record) => ({
      id: record.id,
      action: record.action,
      actorUserId: record.actorUserId,
      actorName: record.actorUser.name,
      reason: record.reason,
      beforeSnapshot: record.beforeSnapshot,
      afterSnapshot: record.afterSnapshot,
      impactSummary: record.impactSummary,
      createdAt: record.createdAt.toISOString(),
    }));
  }

  private async getOrder(tenantId: string, orderId: string, includeDeleted = false) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId, deletedAt: includeDeleted ? undefined : null },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException("Order not found");
    }
    return order;
  }

  private assertCurrent(order: { updatedAt: Date; deletedAt: Date | null }, expected: string): void {
    assertOrderVersion(order.updatedAt, order.deletedAt, expected);
  }

  private async validateProducts(tenantId: string, productIds: string[]): Promise<void> {
    const count = await this.prisma.product.count({
      where: { tenantId, id: { in: [...new Set(productIds)] } },
    });
    if (count !== new Set(productIds).size) {
      throw new BadRequestException("One or more products do not belong to this store");
    }
  }
}

function decimal(value?: string | null): Prisma.Decimal | null {
  return value == null || value === "" ? null : new Prisma.Decimal(value);
}

function jsonSnapshot(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toResponse(order: MaintainableOrder) {
  return {
    ...order,
    total: order.total.toFixed(2),
    paymentGrossAmount: order.paymentGrossAmount?.toFixed(2) ?? null,
    paymentFeeAmount: order.paymentFeeAmount?.toFixed(2) ?? null,
    paymentNetAmount: order.paymentNetAmount?.toFixed(2) ?? null,
    paymentReleaseExpectedAt: order.paymentReleaseExpectedAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    deletedAt: order.deletedAt?.toISOString() ?? null,
    items: order.items.map((item) => ({
      ...item,
      unitPrice: item.unitPrice.toFixed(2),
      total: item.total.toFixed(2),
    })),
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

async function lockOrderVersion(
  tx: Prisma.TransactionClient,
  tenantId: string,
  orderId: string,
  expectedUpdatedAt: string
): Promise<void> {
  const result = await tx.order.updateMany({
    where: {
      id: orderId,
      tenantId,
      deletedAt: null,
      updatedAt: new Date(expectedUpdatedAt),
    },
    data: { updatedAt: new Date() },
  });

  if (result.count !== 1) {
    throw new ConflictException("Order changed since it was opened");
  }
}
