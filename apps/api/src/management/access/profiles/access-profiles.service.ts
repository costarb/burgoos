import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  AccessAuditEventType,
  AccessAuditResult,
  AccessProfileScope,
  AccessProfileStatus,
  Prisma,
} from "@prisma/client";
import { AuthUser } from "../../../platform/auth/auth.types";
import { PrismaService } from "../../../platform/database/prisma.service";
import { AccessAuditService } from "../access-audit.service";
import {
  AccessProfileDto,
  AccessProfilesQueryDto,
  AccessProfileUpdateDto,
} from "../dto/access-profile.dto";
import { ACCESS_PERMISSIONS } from "../permissions/permission-catalog";
import { assertCanDelegatePermissions } from "../users/user-access-rules";

@Injectable()
export class AccessProfilesService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AccessAuditService)
    private readonly audit: AccessAuditService
  ) {}

  async list(actor: AuthUser, query: AccessProfilesQueryDto = {}) {
    return this.prisma.accessProfile.findMany({
      where: this.scopeWhere(actor, {
        tenantId: query.storeId,
        status: query.status,
        ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
      }),
      orderBy: [{ scope: "asc" }, { name: "asc" }],
      include: {
        permissions: { include: { permission: true } },
      },
    });
  }

  async get(actor: AuthUser, profileId: string) {
    const profile = await this.prisma.accessProfile.findFirst({
      where: this.scopeWhere(actor, { id: profileId }),
      include: {
        permissions: { include: { permission: true } },
      },
    });

    if (!profile) {
      throw new NotFoundException("Perfil nao encontrado");
    }

    return profile;
  }

  async create(actor: AuthUser, dto: AccessProfileDto) {
    this.assertCanManageProfileScope(actor, dto.scope, dto.storeId ?? null);
    assertCanDelegatePermissions(actor, dto.permissionKeys);
    await this.ensurePermissionCatalog(dto.permissionKeys);
    await this.ensureUniqueName(dto.name, dto.storeId ?? null);

    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.accessProfile.create({
        data: {
          tenantId: dto.scope === AccessProfileScope.GLOBAL ? null : dto.storeId,
          name: dto.name,
          description: dto.description ?? null,
          scope: dto.scope,
          createdByUserId: actor.isPlatformAdmin ? null : actor.id,
          updatedByUserId: actor.isPlatformAdmin ? null : actor.id,
          permissions: {
            create: dto.permissionKeys.map((key) => ({
              permission: { connect: { key } },
            })),
          },
        },
        include: { permissions: { include: { permission: true } } },
      });

      await this.audit.record(
        {
          actorUserId: actor.isPlatformAdmin ? null : actor.id,
          storeId: profile.tenantId,
          eventType: AccessAuditEventType.PROFILE_CREATED,
          result: AccessAuditResult.SUCCESS,
          metadata: { profileId: profile.id, permissionKeys: dto.permissionKeys },
        },
        tx
      );

      return profile;
    });
  }

  async update(actor: AuthUser, profileId: string, dto: AccessProfileUpdateDto) {
    const current = await this.get(actor, profileId);
    this.assertCanManageProfileScope(actor, current.scope, current.tenantId);

    if (dto.permissionKeys) {
      assertCanDelegatePermissions(actor, dto.permissionKeys);
      await this.ensurePermissionCatalog(dto.permissionKeys);
    }

    if (dto.status === AccessProfileStatus.INACTIVE) {
      const activeAssignments = await this.prisma.userStoreAssignment.count({
        where: { profileId, status: AccessProfileStatus.ACTIVE },
      });

      if (activeAssignments > 0) {
        throw new ConflictException("Perfil em uso por usuarios ativos");
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.permissionKeys) {
        await tx.accessProfilePermission.deleteMany({ where: { profileId } });
      }

      const updated = await tx.accessProfile.update({
        where: { id: profileId },
        data: {
          name: dto.name,
          description: dto.description,
          status: dto.status,
          updatedByUserId: actor.isPlatformAdmin ? null : actor.id,
          permissions: dto.permissionKeys
            ? {
                create: dto.permissionKeys.map((key) => ({
                  permission: { connect: { key } },
                })),
              }
            : undefined,
        },
        include: { permissions: { include: { permission: true } } },
      });

      await this.audit.record(
        {
          actorUserId: actor.isPlatformAdmin ? null : actor.id,
          storeId: updated.tenantId,
          eventType: AccessAuditEventType.PROFILE_UPDATED,
          result: AccessAuditResult.SUCCESS,
          metadata: { profileId, changedFields: Object.keys(dto) },
        },
        tx
      );

      return updated;
    });
  }

  async duplicate(actor: AuthUser, profileId: string, name: string, tenantId?: string | null) {
    const current = await this.get(actor, profileId);
    const targetTenantId = tenantId ?? current.tenantId;
    const targetScope = targetTenantId ? AccessProfileScope.STORE : AccessProfileScope.GLOBAL;

    this.assertCanManageProfileScope(actor, targetScope, targetTenantId);
    await this.ensureUniqueName(name, targetTenantId);

    const permissionKeys = current.permissions.map((grant) => grant.permission.key);
    assertCanDelegatePermissions(actor, permissionKeys);

    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.accessProfile.create({
        data: {
          tenantId: targetTenantId,
          name,
          description: current.description,
          scope: targetScope,
          createdByUserId: actor.isPlatformAdmin ? null : actor.id,
          updatedByUserId: actor.isPlatformAdmin ? null : actor.id,
          permissions: {
            create: permissionKeys.map((key) => ({
              permission: { connect: { key } },
            })),
          },
        },
        include: { permissions: { include: { permission: true } } },
      });

      await this.audit.record(
        {
          actorUserId: actor.isPlatformAdmin ? null : actor.id,
          storeId: profile.tenantId,
          eventType: AccessAuditEventType.PROFILE_CREATED,
          result: AccessAuditResult.SUCCESS,
          metadata: { duplicatedFromProfileId: profileId, profileId: profile.id },
        },
        tx
      );

      return profile;
    });
  }

  async ensurePermissionCatalog(
    permissionKeys = ACCESS_PERMISSIONS.map((permission) => permission.key)
  ) {
    await this.prisma.$transaction(
      ACCESS_PERMISSIONS.filter((permission) => permissionKeys.includes(permission.key)).map(
        (permission) =>
          this.prisma.permission.upsert({
            where: { key: permission.key },
            create: permission,
            update: permission,
          })
      )
    );
  }

  private async ensureUniqueName(name: string, tenantId: string | null) {
    const existing = await this.prisma.accessProfile.findFirst({
      where: { name, tenantId },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException("Ja existe perfil com este nome no escopo");
    }
  }

  private assertCanManageProfileScope(
    actor: AuthUser,
    scope: AccessProfileScope,
    tenantId: string | null
  ): void {
    if (actor.isMaster || actor.isPlatformAdmin) {
      return;
    }

    if (
      scope === AccessProfileScope.STORE &&
      tenantId &&
      actor.manageableStoreIds?.includes(tenantId)
    ) {
      return;
    }

    throw new ConflictException("Usuario nao pode gerenciar este perfil");
  }

  private scopeWhere(
    actor: AuthUser,
    where: Prisma.AccessProfileWhereInput
  ): Prisma.AccessProfileWhereInput {
    if (actor.isMaster || actor.isPlatformAdmin) {
      return where;
    }

    const storeIds = actor.manageableStoreIds ?? [];

    return {
      AND: [
        where,
        {
          OR: [{ scope: AccessProfileScope.GLOBAL }, { tenantId: { in: storeIds } }],
        },
      ],
    };
  }
}
