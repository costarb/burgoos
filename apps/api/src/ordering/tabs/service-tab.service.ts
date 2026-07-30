import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  OperationalEventSource,
  OperationalEventType,
  Prisma,
  ServiceTabStatus,
} from "@prisma/client";
import { randomInt } from "node:crypto";
import { AuthUser } from "../../platform/auth/auth.types";
import { PrismaService } from "../../platform/database/prisma.service";
import { OperationalEventService } from "../operational-events/operational-event.service";
import {
  CancelServiceTabDto,
  CheckoutServiceTabDto,
  OpenServiceTabDto,
  ReopenServiceTabDto,
  UpdateServiceTabDto,
} from "./dto/service-tab.dto";
import { canTransitionTabStatus } from "./tab-status";

const tabInclude = {
  orders: {
    where: { deletedAt: null },
    include: { items: { include: { modifications: true } } },
    orderBy: { createdAt: "asc" as const },
  },
  paymentAllocations: {
    where: {
      payment: { cancelledAt: null, refundedAt: null },
    },
    include: { payment: true },
  },
  charges: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.ServiceTabInclude;

type TabAggregate = Prisma.ServiceTabGetPayload<{ include: typeof tabInclude }>;

export const VERSION_CONFLICT = "VERSION_CONFLICT";

@Injectable()
export class ServiceTabService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: OperationalEventService,
  ) {}

  async list(tenantId: string, status?: ServiceTabStatus) {
    const tabs = await this.prisma.serviceTab.findMany({
      where: {
        tenantId,
        status: status ?? { in: [ServiceTabStatus.OPEN, ServiceTabStatus.CHECKOUT_PENDING] },
      },
      include: tabInclude,
      orderBy: { openedAt: "asc" },
    });
    const assignments = await this.assignmentProjection(tenantId, tabs);
    return tabs.map((tab) => this.toSummary(tab, assignments.get(tab.id) ?? null));
  }

  async detail(tenantId: string, tabId: string) {
    const tab = await this.prisma.serviceTab.findFirst({
      where: { id: tabId, tenantId },
      include: tabInclude,
    });
    if (!tab) throw new NotFoundException("Comanda nao encontrada");
    const assignments = await this.assignmentProjection(tenantId, [tab]);
    return this.toDetail(tab, assignments.get(tab.id) ?? null);
  }

  async open(user: AuthUser, dto: OpenServiceTabDto) {
    const normalizedNumber = normalizeTabNumber(dto.number);
    const existing = await this.prisma.serviceTab.findFirst({
      where: {
        tenantId: user.tenantId,
        normalizedNumber,
        status: { in: [ServiceTabStatus.OPEN, ServiceTabStatus.CHECKOUT_PENDING] },
      },
      select: { id: true },
    });
    if (existing) throw new ConflictException("Ja existe uma comanda ativa com este numero");

    const tab = await this.prisma.serviceTab.create({
      data: {
        tenantId: user.tenantId,
        number: dto.number.trim(),
        normalizedNumber,
        displayName: dto.displayName?.trim() || null,
        publicCode: await this.nextPublicCode(user.tenantId),
        openedByUserId: user.id,
        assignedUserId: user.id,
        notes: dto.notes?.trim() || null,
      },
      include: tabInclude,
    });
    await this.record(user, tab.id, OperationalEventType.TAB_OPENED);
    return this.detail(user.tenantId, tab.id);
  }

  async update(user: AuthUser, tabId: string, dto: UpdateServiceTabDto) {
    await this.requireTab(user.tenantId, tabId);
    const updated = await this.prisma.serviceTab.updateMany({
      where: {
        id: tabId,
        tenantId: user.tenantId,
        version: dto.expectedVersion,
        status: { in: [ServiceTabStatus.OPEN, ServiceTabStatus.CHECKOUT_PENDING] },
      },
      data: {
        displayName: dto.displayName === null ? null : dto.displayName?.trim(),
        notes: dto.notes === null ? null : dto.notes?.trim(),
        version: { increment: 1 },
      },
    });
    this.assertUpdated(updated.count);
    return this.detail(user.tenantId, tabId);
  }

  async startCheckout(user: AuthUser, tabId: string, dto: CheckoutServiceTabDto) {
    const tab = await this.requireTab(user.tenantId, tabId);
    if (tab.assignedUserId && tab.assignedUserId !== user.id) {
      throw new ConflictException({
        statusCode: 409,
        code: "TAB_ASSIGNED_TO_ANOTHER_USER",
        message: "Transfira a responsabilidade da comanda antes de iniciar a cobranca",
        assignedUserId: tab.assignedUserId,
      });
    }
    return this.transition(user, tabId, dto.expectedVersion, {
      from: ServiceTabStatus.OPEN,
      to: ServiceTabStatus.CHECKOUT_PENDING,
      data: {
        checkoutStartedAt: new Date(),
        checkoutStartedByUserId: user.id,
      },
      event: OperationalEventType.TAB_CHECKOUT_STARTED,
    });
  }

  async reopen(user: AuthUser, tabId: string, dto: ReopenServiceTabDto) {
    return this.transition(user, tabId, dto.expectedVersion, {
      from: ServiceTabStatus.CHECKOUT_PENDING,
      to: ServiceTabStatus.OPEN,
      data: { checkoutStartedAt: null, checkoutStartedByUserId: null },
      event: OperationalEventType.TAB_REOPENED,
      reason: dto.reason,
    });
  }

  async cancel(user: AuthUser, tabId: string, dto: CancelServiceTabDto) {
    const tab = await this.requireTab(user.tenantId, tabId);
    const totals = deriveTabTotals(tab.orders, tab.paymentAllocations);
    if (!totals.grossTotal.isZero() || !totals.paidAmount.isZero()) {
      throw new ConflictException("Comanda com pedidos ou pagamentos nao pode ser cancelada");
    }
    if (!canTransitionTabStatus(tab.status, ServiceTabStatus.CANCELLED)) {
      throw new ConflictException("Estado da comanda nao permite cancelamento");
    }
    const updated = await this.prisma.serviceTab.updateMany({
      where: {
        id: tabId,
        tenantId: user.tenantId,
        version: dto.expectedVersion,
        status: tab.status,
      },
      data: {
        status: ServiceTabStatus.CANCELLED,
        closedAt: new Date(),
        closedByUserId: user.id,
        version: { increment: 1 },
      },
    });
    this.assertUpdated(updated.count);
    await this.record(user, tabId, OperationalEventType.TAB_CANCELLED, dto.reason);
    return this.detail(user.tenantId, tabId);
  }

  private async transition(
    user: AuthUser,
    tabId: string,
    expectedVersion: number,
    transition: {
      from: ServiceTabStatus;
      to: ServiceTabStatus;
      data: Prisma.ServiceTabUpdateManyMutationInput;
      event: OperationalEventType;
      reason?: string;
    },
  ) {
    if (!canTransitionTabStatus(transition.from, transition.to)) {
      throw new ConflictException("Transicao de comanda invalida");
    }
    await this.requireTab(user.tenantId, tabId);
    const updated = await this.prisma.serviceTab.updateMany({
      where: {
        id: tabId,
        tenantId: user.tenantId,
        version: expectedVersion,
        status: transition.from,
      },
      data: {
        ...transition.data,
        status: transition.to,
        version: { increment: 1 },
      },
    });
    this.assertUpdated(updated.count);
    await this.record(user, tabId, transition.event, transition.reason);
    return this.detail(user.tenantId, tabId);
  }

  private async requireTab(tenantId: string, tabId: string): Promise<TabAggregate> {
    const tab = await this.prisma.serviceTab.findFirst({
      where: { id: tabId, tenantId },
      include: tabInclude,
    });
    if (!tab) throw new NotFoundException("Comanda nao encontrada");
    return tab;
  }

  private assertUpdated(count: number) {
    if (count !== 1) {
      throw new ConflictException({
        statusCode: 409,
        code: VERSION_CONFLICT,
        message: "A comanda foi atualizada por outro operador",
      });
    }
  }

  private record(
    user: AuthUser,
    tabId: string,
    type: OperationalEventType,
    reason?: string,
  ) {
    return this.events.record({
      tenantId: user.tenantId,
      serviceTabId: tabId,
      actorUserId: user.id,
      type,
      source: OperationalEventSource.USER,
      reason,
    });
  }

  private async nextPublicCode(tenantId: string) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = `C${String(randomInt(1, 10000)).padStart(4, "0")}`;
      if (!(await this.prisma.serviceTab.count({ where: { tenantId, publicCode: code } }))) {
        return code;
      }
    }
    throw new ConflictException("Nao foi possivel gerar codigo da comanda");
  }

  private async assignmentProjection(tenantId: string, tabs: TabAggregate[]) {
    const assigned = tabs.filter(
      (tab): tab is TabAggregate & { assignedUserId: string } => Boolean(tab.assignedUserId),
    );
    if (assigned.length === 0) {
      return new Map<string, { userId: string; userName: string; assignedAt: string }>();
    }
    const [users, events] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: [...new Set(assigned.map((tab) => tab.assignedUserId))] } },
        select: { id: true, name: true },
      }),
      this.prisma.orderOperationalEvent.findMany({
        where: {
          tenantId,
          serviceTabId: { in: assigned.map((tab) => tab.id) },
          type: {
            in: [
              OperationalEventType.ORDER_ASSIGNED,
              OperationalEventType.ORDER_ASSIGNMENT_TRANSFERRED,
            ],
          },
        },
        orderBy: { occurredAt: "desc" },
        select: { serviceTabId: true, occurredAt: true },
      }),
    ]);
    const names = new Map(users.map((candidate) => [candidate.id, candidate.name]));
    const assignedAt = new Map<string, Date>();
    for (const event of events) {
      if (event.serviceTabId && !assignedAt.has(event.serviceTabId)) {
        assignedAt.set(event.serviceTabId, event.occurredAt);
      }
    }
    return new Map(
      assigned.map((tab) => [
        tab.id,
        {
          userId: tab.assignedUserId,
          userName: names.get(tab.assignedUserId) ?? "Usuario indisponivel",
          assignedAt: (assignedAt.get(tab.id) ?? tab.updatedAt).toISOString(),
        },
      ]),
    );
  }

  private toSummary(
    tab: TabAggregate,
    assignment: { userId: string; userName: string; assignedAt: string } | null = null,
  ) {
    const totals = deriveTabTotals(tab.orders, tab.paymentAllocations);
    return {
      id: tab.id,
      number: tab.number,
      displayName: tab.displayName,
      publicCode: tab.publicCode,
      status: tab.status,
      assignedUserId: tab.assignedUserId,
      assignment,
      grossTotal: totals.grossTotal.toFixed(2),
      paidAmount: totals.paidAmount.toFixed(2),
      openBalance: totals.openBalance.toFixed(2),
      version: tab.version,
      openedAt: tab.openedAt.toISOString(),
      closedAt: tab.closedAt?.toISOString() ?? null,
    };
  }

  private toDetail(
    tab: TabAggregate,
    assignment: { userId: string; userName: string; assignedAt: string } | null = null,
  ) {
    return {
      ...this.toSummary(tab, assignment),
      notes: tab.notes,
      orders: tab.orders.map((order) => ({
        id: order.id,
        publicCode: order.publicCode,
        serviceTabId: order.serviceTabId,
        source: order.source,
        status: order.status,
        paymentStatus: "UNPAID",
        fulfillmentMethod: order.fulfillmentMethod,
        total: order.total.toFixed(2),
        customerName: order.customerName || null,
        customerPhone: order.customerPhone || null,
        assignedUserId: order.assignedUserId,
        version: order.version,
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
      })),
      charges: tab.charges.map((charge) => ({
        id: charge.id,
        status: charge.status,
        amount: charge.amount.toFixed(2),
      })),
    };
  }
}

export function deriveTabTotals(
  orders: Array<{ total: Prisma.Decimal; status?: string }>,
  allocations: Array<{ amount: Prisma.Decimal }>,
) {
  const grossTotal = orders
    .filter((order) => order.status !== "CANCELLED")
    .reduce(
    (sum, order) => sum.add(order.total),
    new Prisma.Decimal(0),
  );
  const paidAmount = allocations.reduce(
    (sum, allocation) => sum.add(allocation.amount),
    new Prisma.Decimal(0),
  );
  return {
    grossTotal,
    paidAmount,
    openBalance: Prisma.Decimal.max(grossTotal.sub(paidAmount), 0),
  };
}

export function normalizeTabNumber(value: string): string {
  return value.trim().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, "").toUpperCase();
}
