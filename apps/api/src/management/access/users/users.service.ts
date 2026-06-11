import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AccessAuditEventType,
  AccessAuditResult,
  AccessUserStatus,
  Prisma,
  UserRole,
} from "@prisma/client";
import { randomBytes } from "crypto";
import { AuthCryptoService } from "../../../auth/auth-crypto.service";
import { AuthUser } from "../../../platform/auth/auth.types";
import { PrismaService } from "../../../platform/database/prisma.service";
import { AccessAuditService } from "../access-audit.service";
import { AccessUserDto, AccessUsersQueryDto, AccessUserUpdateDto } from "../dto/user-access.dto";
import { assertCanRemoveMaster } from "./user-access-rules";
import {
  assertCanManageAssignments,
  assertCanManageTarget,
  manageableStoreIds,
} from "./store-admin-user-rules";

@Injectable()
export class UsersService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AuthCryptoService)
    private readonly crypto: AuthCryptoService,
    @Inject(AccessAuditService)
    private readonly audit: AccessAuditService
  ) {}

  async list(actor: AuthUser, query: AccessUsersQueryDto = {}) {
    const localStoreIds = manageableStoreIds(actor);

    const users = await this.prisma.user.findMany({
      where: {
        status: query.status,
        storeAssignments:
          actor.isMaster || actor.isPlatformAdmin
            ? query.storeId
              ? { some: { tenantId: query.storeId } }
              : undefined
            : { some: { tenantId: { in: localStoreIds } } },
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { email: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
      include: this.userInclude,
    });

    return users.map((user) => this.toDetail(user));
  }

  async get(actor: AuthUser, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: this.userInclude,
    });

    if (!user) {
      throw new NotFoundException("Usuario nao encontrado");
    }

    assertCanManageTarget(actor, user);
    return this.toDetail(user);
  }

  async options(actor: AuthUser) {
    const localStoreIds = manageableStoreIds(actor);

    const [stores, profiles] = await Promise.all([
      this.prisma.tenant.findMany({
        where:
          actor.isMaster || actor.isPlatformAdmin
            ? undefined
            : {
                id: { in: localStoreIds },
              },
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true, active: true },
      }),
      this.prisma.accessProfile.findMany({
        where:
          actor.isMaster || actor.isPlatformAdmin
            ? undefined
            : {
                OR: [{ tenantId: { in: localStoreIds } }, { scope: "GLOBAL" }],
              },
        orderBy: [{ scope: "asc" }, { name: "asc" }],
        select: { id: true, name: true, scope: true, tenantId: true, status: true },
      }),
    ]);

    return {
      stores,
      profiles: profiles.map((profile) => ({
        id: profile.id,
        name: profile.name,
        scope: profile.scope,
        storeId: profile.tenantId,
        status: profile.status,
      })),
    };
  }

  async create(actor: AuthUser, dto: AccessUserDto) {
    if (!actor.isMaster && !actor.isPlatformAdmin && dto.isMaster) {
      await this.recordAccessDenied(
        actor,
        dto.assignments[0]?.storeId ?? null,
        "STORE_ADMIN_MASTER_CREATE"
      );
      throw new ForbiddenException("Admin de loja nao pode criar usuario master");
    }

    try {
      assertCanManageAssignments(actor, dto.assignments);
    } catch (error) {
      await this.recordAccessDenied(
        actor,
        dto.assignments[0]?.storeId ?? null,
        "STORE_ADMIN_ASSIGNMENT_SCOPE"
      );
      throw error;
    }

    await this.ensureUniqueLogin(dto.login);

    const firstTenantId = dto.assignments[0]?.storeId ?? actor.tenantId;
    const passwordHash = await this.crypto.hashSecret(randomBytes(24).toString("hex"));

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          tenantId: firstTenantId,
          role: dto.isMaster ? UserRole.ADMIN : UserRole.OPERATOR,
          status: AccessUserStatus.INVITED,
          isMaster: dto.isMaster,
          name: dto.name,
          email: dto.email,
          phone: dto.phone ?? null,
          passwordHash,
          storeAssignments: {
            create: dto.assignments.map((assignment) => ({
              tenantId: assignment.storeId,
              profileId: assignment.profileId,
              canManageStoreAccess: assignment.canManageStoreAccess,
              status: assignment.status,
            })),
          },
        },
        include: this.userInclude,
      });

      await this.audit.record(
        {
          actorUserId: actor.id,
          targetUserId: user.id,
          storeId: firstTenantId,
          eventType: AccessAuditEventType.USER_CREATED,
          result: AccessAuditResult.SUCCESS,
          metadata: { login: dto.login, isMaster: dto.isMaster },
        },
        tx
      );

      return user;
    });

    return this.toDetail(created);
  }

  async update(actor: AuthUser, userId: string, dto: AccessUserUpdateDto) {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      include: this.userInclude,
    });

    if (!current) {
      throw new NotFoundException("Usuario nao encontrado");
    }

    try {
      assertCanManageTarget(actor, current);
      assertCanManageAssignments(actor, dto.assignments);

      if (!actor.isMaster && !actor.isPlatformAdmin && dto.isMaster !== undefined) {
        throw new ForbiddenException("Admin de loja nao pode alterar perfil master");
      }

      if (actor.isMaster || actor.isPlatformAdmin) {
        await assertCanRemoveMaster(current, dto, () =>
          this.prisma.user.count({
            where: {
              isMaster: true,
              status: AccessUserStatus.ACTIVE,
            },
          })
        );
      }
    } catch (error) {
      await this.recordAccessDenied(actor, current.tenantId, "STORE_ADMIN_USER_SCOPE", userId);
      throw error;
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.assignments) {
        await tx.userStoreAssignment.deleteMany({ where: { userId } });
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
          status: dto.status,
          isMaster: dto.isMaster,
          role: dto.isMaster === true ? UserRole.ADMIN : undefined,
          storeAssignments: dto.assignments
            ? {
                create: dto.assignments.map((assignment) => ({
                  tenantId: assignment.storeId,
                  profileId: assignment.profileId,
                  canManageStoreAccess: assignment.canManageStoreAccess,
                  status: assignment.status,
                })),
              }
            : undefined,
        },
        include: this.userInclude,
      });

      await this.audit.record(
        {
          actorUserId: actor.id,
          targetUserId: userId,
          storeId: updated.tenantId,
          eventType: AccessAuditEventType.USER_UPDATED,
          result: AccessAuditResult.SUCCESS,
          metadata: this.toAuditMetadata(dto),
        },
        tx
      );

      return this.toDetail(updated);
    });
  }

  private async ensureUniqueLogin(login: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { email: login } });

    if (existing) {
      throw new ConflictException("Login ja existe");
    }
  }

  private toAuditMetadata(dto: AccessUserUpdateDto): Prisma.InputJsonObject {
    return {
      changedFields: Object.keys(dto).filter((key) => key !== "assignments"),
      assignmentsChanged: Boolean(dto.assignments),
    };
  }

  private async recordAccessDenied(
    actor: AuthUser,
    storeId: string | null,
    reason: string,
    targetUserId?: string
  ) {
    await this.audit.record({
      actorUserId: actor.id,
      targetUserId,
      storeId,
      eventType: AccessAuditEventType.ACCESS_DENIED,
      result: AccessAuditResult.DENIED,
      reason,
    });
  }

  private get userInclude() {
    return {
      storeAssignments: {
        include: {
          tenant: true,
          profile: true,
        },
      },
    } satisfies Prisma.UserInclude;
  }

  private toDetail(
    user: Prisma.UserGetPayload<{
      include: {
        storeAssignments: {
          include: {
            tenant: true;
            profile: true;
          };
        };
      };
    }>
  ) {
    return {
      id: user.id,
      login: user.email,
      name: user.name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      isMaster: user.isMaster,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      assignments: user.storeAssignments.map((assignment) => ({
        store: {
          id: assignment.tenant.id,
          name: assignment.tenant.name,
          slug: assignment.tenant.slug,
          active: assignment.tenant.active,
        },
        profile: {
          id: assignment.profile.id,
          name: assignment.profile.name,
          scope: assignment.profile.scope,
          storeId: assignment.profile.tenantId,
          status: assignment.profile.status,
        },
        canManageStoreAccess: assignment.canManageStoreAccess,
        status: assignment.status,
      })),
    };
  }
}
