import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AccessProfileStatus,
  AccessUserStatus,
  OperationalEventSource,
  OperationalEventType,
} from "@prisma/client";
import { AuthUser } from "../../platform/auth/auth.types";
import { PrismaService } from "../../platform/database/prisma.service";
import {
  ClaimOperationalAssignmentDto,
  TransferOperationalAssignmentDto,
} from "./dto/operational-assignment.dto";

export const ASSIGNMENT_VERSION_CONFLICT = "ASSIGNMENT_VERSION_CONFLICT";
type AssignmentTarget = "order" | "tab";

@Injectable()
export class OperationalAssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  listAssignees(user: AuthUser) {
    return this.prisma.user.findMany({
      where: {
        status: AccessUserStatus.ACTIVE,
        OR: [
          { tenantId: user.tenantId },
          {
            storeAssignments: {
              some: { tenantId: user.tenantId, status: AccessProfileStatus.ACTIVE },
            },
          },
        ],
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    });
  }

  claimOrder(user: AuthUser, orderId: string, dto: ClaimOperationalAssignmentDto) {
    return this.assign("order", user, orderId, user.id, dto.expectedVersion);
  }

  transferOrder(user: AuthUser, orderId: string, dto: TransferOperationalAssignmentDto) {
    return this.assign("order", user, orderId, dto.assigneeUserId, dto.expectedVersion, dto.reason);
  }

  claimTab(user: AuthUser, tabId: string, dto: ClaimOperationalAssignmentDto) {
    return this.assign("tab", user, tabId, user.id, dto.expectedVersion);
  }

  transferTab(user: AuthUser, tabId: string, dto: TransferOperationalAssignmentDto) {
    return this.assign("tab", user, tabId, dto.assigneeUserId, dto.expectedVersion, dto.reason);
  }

  private async assign(
    target: AssignmentTarget,
    user: AuthUser,
    targetId: string,
    assigneeUserId: string,
    expectedVersion: number,
    reason?: string,
  ) {
    const assignee = await this.requireActiveAssignee(user.tenantId, assigneeUserId);
    const current = await this.findTarget(target, user.tenantId, targetId);
    if (!current) {
      throw new NotFoundException(target === "order" ? "Pedido nao encontrado" : "Comanda nao encontrada");
    }
    const isTransfer = Boolean(current.assignedUserId && current.assignedUserId !== assigneeUserId);
    if (isTransfer && !reason?.trim()) {
      throw new ConflictException("A transferencia de responsabilidade exige justificativa");
    }

    return this.prisma.$transaction(async (tx) => {
      const where = { id: targetId, tenantId: user.tenantId, version: expectedVersion };
      const data = { assignedUserId: assigneeUserId, version: { increment: 1 } };
      const updated =
        target === "order"
          ? await tx.order.updateMany({ where: { ...where, deletedAt: null }, data })
          : await tx.serviceTab.updateMany({ where, data });
      if (updated.count !== 1) {
        throw new ConflictException({
          statusCode: 409,
          code: ASSIGNMENT_VERSION_CONFLICT,
          message: "A responsabilidade foi atualizada por outro operador",
        });
      }

      const occurredAt = new Date();
      await tx.orderOperationalEvent.create({
        data: {
          tenantId: user.tenantId,
          orderId: target === "order" ? targetId : null,
          serviceTabId: target === "tab" ? targetId : null,
          actorUserId: user.id,
          source: OperationalEventSource.USER,
          type: isTransfer
            ? OperationalEventType.ORDER_ASSIGNMENT_TRANSFERRED
            : OperationalEventType.ORDER_ASSIGNED,
          reason: reason?.trim() || null,
          metadata: {
            previousAssigneeUserId: current.assignedUserId,
            assigneeUserId,
            target,
          },
          occurredAt,
        },
      });
      return {
        target,
        targetId,
        version: expectedVersion + 1,
        assignment: {
          userId: assignee.id,
          userName: assignee.name,
          assignedAt: occurredAt.toISOString(),
        },
      };
    });
  }

  private findTarget(target: AssignmentTarget, tenantId: string, targetId: string) {
    return target === "order"
      ? this.prisma.order.findFirst({
          where: { id: targetId, tenantId, deletedAt: null },
          select: { assignedUserId: true },
        })
      : this.prisma.serviceTab.findFirst({
          where: { id: targetId, tenantId },
          select: { assignedUserId: true },
        });
  }

  private async requireActiveAssignee(tenantId: string, assigneeUserId: string) {
    const assignee = await this.prisma.user.findFirst({
      where: {
        id: assigneeUserId,
        status: AccessUserStatus.ACTIVE,
        OR: [
          { tenantId },
          {
            storeAssignments: {
              some: { tenantId, status: AccessProfileStatus.ACTIVE },
            },
          },
        ],
      },
      select: { id: true, name: true },
    });
    if (!assignee) throw new NotFoundException("Atendente ativo nao encontrado nesta loja");
    return assignee;
  }
}
