import { Injectable, NotFoundException } from "@nestjs/common";
import { OrderStatus } from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";
import { parseOrderQueueConfig } from "./order-queue-config";

@Injectable()
export class PublicOrderQueueService {
  constructor(private readonly prisma: PrismaService) {}

  bySlug(slug: string, now = new Date()) {
    return this.project({ slug: normalizeSlug(slug) }, now);
  }

  byDomain(domain: string, now = new Date()) {
    return this.project({ publicDomain: normalizeDomain(domain) }, now);
  }

  private async project(
    identity: { slug: string } | { publicDomain: string },
    now: Date,
  ) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { ...identity, active: true },
      select: { id: true, name: true, config: true },
    });
    if (!tenant) throw new NotFoundException("Fila publica nao encontrada");

    const config = parseOrderQueueConfig(tenant.config);
    if (!config.enabled) throw new NotFoundException("Fila publica nao encontrada");

    const [active, completed] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          tenantId: tenant.id,
          deletedAt: null,
          status: { in: config.activeStatuses },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: queueSelect,
      }),
      this.prisma.order.findMany({
        where: {
          tenantId: tenant.id,
          deletedAt: null,
          status: { in: config.completedStatuses },
        },
        orderBy: [{ completedAt: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
        take: config.completedLimit,
        select: queueSelect,
      }),
    ]);

    return {
      storeName: tenant.name,
      generatedAt: now.toISOString(),
      staleAfterSeconds: config.staleAfterSeconds,
      active: active.map((order) => publicItem(order, config.showNickname)),
      completed: completed.map((order) => publicItem(order, config.showNickname)),
    };
  }
}

const queueSelect = {
  id: true,
  publicCode: true,
  customerName: true,
  status: true,
  createdAt: true,
  productionStartedAt: true,
  readyAt: true,
  completedAt: true,
  updatedAt: true,
} as const;

type QueueOrder = {
  id: string;
  publicCode: string | null;
  customerName: string;
  status: OrderStatus;
  createdAt: Date;
  productionStartedAt: Date | null;
  readyAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
};

function publicItem(order: QueueOrder, showNickname: boolean) {
  return {
    publicCode: order.publicCode ?? order.id.slice(0, 8).toUpperCase(),
    displayName: showNickname ? safeNickname(order.customerName) : null,
    status: order.status,
    enteredAt: enteredAt(order).toISOString(),
  };
}

function enteredAt(order: QueueOrder): Date {
  if (order.status === OrderStatus.DELIVERED) return order.completedAt ?? order.updatedAt;
  if (order.status === OrderStatus.READY) return order.readyAt ?? order.updatedAt;
  if (order.status === OrderStatus.PREPARING) {
    return order.productionStartedAt ?? order.updatedAt;
  }
  return order.createdAt;
}

function safeNickname(value: string): string | null {
  const nickname = value.trim().replace(/\s+/g, " ").slice(0, 24);
  if (
    nickname.length < 2 ||
    /@|https?:|www\.|\d{5,}/i.test(nickname) ||
    !/^[\p{L}\p{N} .'-]+$/u.test(nickname)
  ) {
    return null;
  }
  return nickname;
}

function normalizeSlug(value: string) {
  const slug = value.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new NotFoundException("Fila publica nao encontrada");
  }
  return slug;
}

function normalizeDomain(value: string) {
  const domain = value.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "")
    .replace(/^www\./, "");
  if (!domain.includes(".") || !/^[a-z0-9.-]+$/.test(domain)) {
    throw new NotFoundException("Fila publica nao encontrada");
  }
  return domain;
}
