import { Inject, Injectable } from "@nestjs/common";
import { AccessProfileStatus, AccessUserStatus, McpDataArea, UserRole } from "@prisma/client";
import { PrismaService } from "../../../platform/database/prisma.service";
import { normalizeAreas } from "../mcp-data-areas";

export const MCP_CONNECT_PERMISSION = "mcp.connect";

export interface EligibleStore {
  id: string;
  name: string;
  areas: McpDataArea[];
  /** Store allows write tools for AI assistants. */
  actionsEnabled: boolean;
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
            profile: {
              select: { permissions: { select: { permission: { select: { key: true } } } } },
            },
          },
        },
      },
    });
    if (!user || !isActiveUser(user.status)) return { reachable: [], authorizable: [] };

    const storeIds = [
      ...new Set([user.tenantId, ...user.storeAssignments.map((item) => item.tenantId)]),
    ];
    const tenants = await this.prisma.tenant.findMany({
      where: {
        ...(user.isMaster ? {} : { id: { in: storeIds } }),
        active: true,
        deactivatedAt: null,
        mcpConfiguration: { is: { enabled: true } },
      },
      select: {
        id: true,
        name: true,
        mcpConfiguration: { select: { enabledAreas: true, actionsEnabled: true } },
      },
      orderBy: { name: "asc" },
    });

    const elevated = user.isMaster || user.role === UserRole.OWNER || user.role === UserRole.ADMIN;
    const permittedByAssignment = new Set(
      user.storeAssignments
        .filter((assignment) =>
          assignment.profile.permissions.some(
            (grant) => grant.permission.key === MCP_CONNECT_PERMISSION
          )
        )
        .map((assignment) => assignment.tenantId)
    );

    const reachable = tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      areas: normalizeAreas(tenant.mcpConfiguration?.enabledAreas ?? []),
      actionsEnabled: tenant.mcpConfiguration?.actionsEnabled ?? false,
    }));
    return {
      reachable,
      authorizable: reachable.filter((store) => elevated || permittedByAssignment.has(store.id)),
    };
  }
}

export interface StorePermissions {
  /** Master, owner or admin: every permission, like the screens' permission guard. */
  elevated: boolean;
  permissions: string[];
}

/**
 * Current permissions of a user in one store, read from the database on each call so a removed
 * permission or assignment applies immediately. Inactive users or stores out of reach get none.
 */
export async function permissionsForStore(
  prisma: PrismaService,
  userId: string,
  tenantId: string
): Promise<StorePermissions> {
  const none: StorePermissions = { elevated: false, permissions: [] };
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      tenantId: true,
      role: true,
      isMaster: true,
      status: true,
      storeAssignments: {
        where: { status: AccessProfileStatus.ACTIVE, tenantId },
        select: {
          tenantId: true,
          profile: {
            select: { permissions: { select: { permission: { select: { key: true } } } } },
          },
        },
      },
    },
  });
  if (!user || !isActiveUser(user.status)) return none;
  const assignments = user.storeAssignments.filter(
    (assignment) => assignment.tenantId === tenantId
  );
  if (!user.isMaster && user.tenantId !== tenantId && assignments.length === 0) return none;

  const elevated = user.isMaster || user.role === UserRole.OWNER || user.role === UserRole.ADMIN;
  const permissions = [
    ...new Set(
      assignments.flatMap((assignment) =>
        assignment.profile.permissions.map((grant) => grant.permission.key)
      )
    ),
  ];
  return { elevated, permissions };
}

export function isActiveUser(status: AccessUserStatus | null | undefined): boolean {
  return (
    status === undefined ||
    status === null ||
    status === AccessUserStatus.ACTIVE ||
    status === AccessUserStatus.INVITED
  );
}
