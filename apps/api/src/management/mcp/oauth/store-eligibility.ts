import { Inject, Injectable } from "@nestjs/common";
import { AccessProfileStatus, AccessUserStatus, McpDataArea, UserRole } from "@prisma/client";
import { PrismaService } from "../../../platform/database/prisma.service";
import { normalizeAreas } from "../mcp-data-areas";

export const MCP_CONNECT_PERMISSION = "mcp.connect";

export interface EligibleStore {
  id: string;
  name: string;
  areas: McpDataArea[];
}

export interface StoreEligibility {
  /** Stores the user can reach with MCP enabled (regardless of the connect permission). */
  reachable: EligibleStore[];
  /** Reachable stores where the user may authorize a connector. */
  authorizable: EligibleStore[];
}

/**
 * Which stores a user may connect an AI assistant to, computed from the database (not the JWT)
 * so a revoked assignment or a disabled MCP is honoured immediately.
 */
@Injectable()
export class StoreEligibilityService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async forUser(userId: string): Promise<StoreEligibility> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        tenantId: true,
        role: true,
        isMaster: true,
        status: true,
        storeAssignments: {
          where: { status: AccessProfileStatus.ACTIVE },
          select: {
            tenantId: true,
            profile: { select: { permissions: { select: { permission: { select: { key: true } } } } } },
          },
        },
      },
    });
    if (!user || !isActiveUser(user.status)) return { reachable: [], authorizable: [] };

    const storeIds = [...new Set([user.tenantId, ...user.storeAssignments.map((item) => item.tenantId)])];
    const tenants = await this.prisma.tenant.findMany({
      where: {
        ...(user.isMaster ? {} : { id: { in: storeIds } }),
        active: true,
        deactivatedAt: null,
        mcpConfiguration: { is: { enabled: true } },
      },
      select: { id: true, name: true, mcpConfiguration: { select: { enabledAreas: true } } },
      orderBy: { name: "asc" },
    });

    const elevated = user.isMaster || user.role === UserRole.OWNER || user.role === UserRole.ADMIN;
    const permittedByAssignment = new Set(
      user.storeAssignments
        .filter((assignment) =>
          assignment.profile.permissions.some((grant) => grant.permission.key === MCP_CONNECT_PERMISSION)
        )
        .map((assignment) => assignment.tenantId)
    );

    const reachable = tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      areas: normalizeAreas(tenant.mcpConfiguration?.enabledAreas ?? []),
    }));
    return {
      reachable,
      authorizable: reachable.filter((store) => elevated || permittedByAssignment.has(store.id)),
    };
  }
}

export function isActiveUser(status: AccessUserStatus | null | undefined): boolean {
  return status === undefined || status === null || status === AccessUserStatus.ACTIVE || status === AccessUserStatus.INVITED;
}
