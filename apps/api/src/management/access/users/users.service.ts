import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
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
import { assertCanRemoveMaster, assertMasterAccess } from "./user-access-rules";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: AuthCryptoService,
    private readonly audit: AccessAuditService
  ) {}

  async list(actor: AuthUser, query: AccessUsersQueryDto = {}) {
    assertMasterAccess(actor);

    return this.prisma.user.findMany({
      where: {
        status: query.status,
        storeAssignments: query.storeId ? { some: { tenantId: query.storeId } } : undefined,
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
  }

  async get(actor: AuthUser, userId: string) {
    assertMasterAccess(actor);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: this.userInclude,
    });

    if (!user) {
      throw new NotFoundException("Usuario nao encontrado");
    }

    return user;
  }

  async options(actor: AuthUser) {
    assertMasterAccess(actor);

    const [stores, profiles] = await Promise.all([
      this.prisma.tenant.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true, active: true },
      }),
      this.prisma.accessProfile.findMany({
        orderBy: [{ scope: "asc" }, { name: "asc" }],
        select: { id: true, name: true, scope: true, tenantId: true, status: true },
      }),
    ]);

    return { stores, profiles };
  }

  async create(actor: AuthUser, dto: AccessUserDto) {
    assertMasterAccess(actor);
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

    return created;
  }

  async update(actor: AuthUser, userId: string, dto: AccessUserUpdateDto) {
    assertMasterAccess(actor);
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      include: this.userInclude,
    });

    if (!current) {
      throw new NotFoundException("Usuario nao encontrado");
    }

    await assertCanRemoveMaster(current, dto, () =>
      this.prisma.user.count({
        where: {
          isMaster: true,
          status: AccessUserStatus.ACTIVE,
        },
      })
    );

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

      return updated;
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
}
