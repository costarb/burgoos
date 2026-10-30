import { Inject, Injectable, Optional } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { OrderSource, OrderStatus } from "@prisma/client";
import { RuntimeRoleService } from "../../../config/runtime-role.service";
import { PrismaService } from "../../../platform/database/prisma.service";
import { FiscalAuditService } from "./fiscal-audit.service";
import { BUSINESS_TIME_ZONE, businessDate } from "./fiscal-eligibility";
import { FiscalEmissionService } from "./fiscal-emission.service";
import type { FiscalTarget } from "./fiscal-sale.loader";

/** Start of the current business day (São Paulo) as a UTC instant. */
export function startOfBusinessDay(now = new Date()): Date {
  const zoneName = new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS_TIME_ZONE, timeZoneName: "longOffset" })
    .formatToParts(now)
    .find((part) => part.type === "timeZoneName")?.value;
  const offset = zoneName?.replace("GMT", "") || "+00:00";
  return new Date(`${businessDate(now)}T00:00:00${offset}`);
}

/**
 * Entry point for automatic emission. Sales hooks call `requestAutomatic` after commit; the
 * sweep recovers anything the hooks missed (research R8). Never throws into the sales flow.
 */
@Injectable()
export class FiscalTriggerService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FiscalEmissionService) private readonly emissions: FiscalEmissionService,
    @Inject(FiscalAuditService) private readonly audit: FiscalAuditService,
    @Optional() @Inject(RuntimeRoleService) private readonly runtimeRole?: RuntimeRoleService
  ) {}

  async requestAutomatic(tenantId: string, target: FiscalTarget): Promise<void> {
    try {
      await this.emissions.request({ tenantId, target, trigger: "AUTOMATIC" });
    } catch (error) {
      this.audit.log("fiscal.trigger.failed", { tenantId, target, reason: (error as Error).message }, "error");
    }
  }

  /** Order created/paid: the tab is the fiscal unit when the order belongs to one. */
  async requestForOrder(tenantId: string, orderId: string): Promise<void> {
    try {
      const order = await this.prisma.order.findFirst({ where: { id: orderId, tenantId }, select: { serviceTabId: true } });
      if (!order) return;
      await this.requestAutomatic(tenantId, order.serviceTabId ? { type: "TAB", id: order.serviceTabId } : { type: "ORDER", id: orderId });
    } catch (error) {
      this.audit.log("fiscal.trigger.failed", { tenantId, orderId, reason: (error as Error).message }, "error");
    }
  }

  @Cron("15 * * * * *")
  async sweep(now = new Date()): Promise<number> {
    if (this.runtimeRole && !this.runtimeRole.consumesBackgroundJobs) return 0;
    let recovered = 0;
    try {
      const tenants = await this.prisma.fiscalConfiguration.findMany({
        where: { enabled: true, emissionMode: "AUTOMATIC" },
        select: { tenantId: true, eligibleSources: true },
      });
      const since = startOfBusinessDay(now);
      for (const { tenantId, eligibleSources } of tenants) {
        const orders = await this.prisma.order.findMany({
          where: {
            tenantId,
            serviceTabId: null,
            deletedAt: null,
            status: { not: OrderStatus.CANCELLED },
            source: { in: eligibleSources.filter((source) => source !== OrderSource.PUBLIC_MENU && source !== OrderSource.IFOOD) },
            createdAt: { gte: since },
            fiscalDocuments: { none: {} },
          },
          select: { id: true },
          take: 200,
        });
        const tabs = eligibleSources.includes(OrderSource.COUNTER)
          ? await this.prisma.serviceTab.findMany({
              where: { tenantId, status: "PAID", closedAt: { gte: since }, fiscalDocuments: { none: {} } },
              select: { id: true },
              take: 200,
            })
          : [];
        const targets: FiscalTarget[] = [
          ...orders.map((order) => ({ type: "ORDER" as const, id: order.id })),
          ...tabs.map((tab) => ({ type: "TAB" as const, id: tab.id })),
        ];
        for (const target of targets) {
          const result = await this.emissions.request({ tenantId, target, trigger: "AUTOMATIC" }).catch((error: Error) => {
            this.audit.log("fiscal.trigger.failed", { tenantId, target, reason: error.message }, "error");
            return null;
          });
          if (result && result.status !== "SKIPPED") {
            recovered += 1;
            this.audit.log("fiscal.trigger.recovered", { tenantId, target, documentId: result.document.id }, "warn");
          }
        }
      }
    } catch (error) {
      this.audit.log("fiscal.sweep.failed", { reason: (error as Error).message }, "error");
    }
    return recovered;
  }
}
