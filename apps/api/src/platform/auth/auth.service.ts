import { ForbiddenException, Inject, Logger, UnauthorizedException } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  AccessAuditEventType,
  AccessAuditResult,
  AccessProfileStatus,
  AccessUserStatus,
  User,
  UserRole,
} from "@prisma/client";
import { compare } from "bcryptjs";
import { PasswordResetService } from "../../auth/password-reset.service";
import { SessionTokenService } from "../../auth/session-token.service";
import { AccessAuditService } from "../../management/access/access-audit.service";
import { PrismaService } from "../database/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { AuthUser, JwtPayload } from "./auth.types";

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  accessTokenExpiresAt?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(JwtService)
    private readonly jwtService: JwtService,
    @Inject(SessionTokenService)
    private readonly sessionTokens: SessionTokenService,
    @Inject(PasswordResetService)
    private readonly passwordReset: PasswordResetService,
    @Inject(AccessAuditService)
    private readonly accessAudit: AccessAuditService
  ) {}

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        tenant: true,
        storeAssignments: {
          where: { status: AccessProfileStatus.ACTIVE },
          include: {
            tenant: true,
            profile: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !(await compare(dto.password, user.passwordHash))) {
      this.logger.warn(`Rejected login for email=${dto.email}`);
      await this.accessAudit.record({
        eventType: AccessAuditEventType.LOGIN_FAILURE,
        result: AccessAuditResult.FAILED,
        reason: "Invalid credentials",
        metadata: { login: dto.email },
      });
      throw new UnauthorizedException("Invalid credentials");
    }

    if (user.status !== AccessUserStatus.ACTIVE && user.status !== AccessUserStatus.INVITED) {
      this.logger.warn(`Rejected login for inactive user=${user.id}`);
      throw new UnauthorizedException("User is inactive");
    }

    if (!user.tenant.active) {
      this.logger.warn(`Rejected login for inactive tenant=${user.tenantId}`);
      throw new UnauthorizedException("Tenant is inactive");
    }

    const allowedStoreIds = [
      ...new Set([
        user.tenantId,
        ...user.storeAssignments.map((assignment) => assignment.tenantId),
      ]),
    ];
    const manageableStoreIds = user.storeAssignments
      .filter((assignment) => assignment.canManageStoreAccess)
      .map((assignment) => assignment.tenantId);
    const permissions = [
      ...new Set(
        user.storeAssignments.flatMap((assignment) =>
          assignment.profile.permissions.map((grant) => grant.permission.key)
        )
      ),
    ];

    const authUser: AuthUser = {
      id: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      name: user.name,
      isMaster: user.isMaster,
      activeStoreId: user.tenantId,
      allowedStoreIds,
      manageableStoreIds,
      permissions,
    };

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), status: AccessUserStatus.ACTIVE },
    });
    const accessToken = await this.signAccessToken(authUser);
    const refreshToken = await this.signRefreshToken(authUser);

    await this.sessionTokens.create(user.id, refreshToken, authUser.activeStoreId);
    await this.accessAudit.record({
      actorUserId: user.id,
      targetUserId: user.id,
      storeId: authUser.activeStoreId,
      eventType: AccessAuditEventType.LOGIN_SUCCESS,
      result: AccessAuditResult.SUCCESS,
    });

    return {
      accessToken,
      refreshToken,
      user: authUser,
      accessTokenExpiresAt: this.accessTokenExpiresAt().toISOString(),
    };
  }

  async loginPlatform(dto: LoginDto): Promise<LoginResult> {
    const platformUser = await this.prisma.platformUser.findUnique({
      where: { email: dto.email },
    });

    if (
      !platformUser ||
      !platformUser.active ||
      !(await compare(dto.password, platformUser.passwordHash))
    ) {
      this.logger.warn(`Rejected platform login for email=${dto.email}`);
      throw new UnauthorizedException("Invalid credentials");
    }

    const authUser: AuthUser = {
      id: platformUser.id,
      tenantId: "",
      role: UserRole.ADMIN,
      email: platformUser.email,
      name: platformUser.name,
      isMaster: true,
      activeStoreId: null,
      allowedStoreIds: [],
      manageableStoreIds: [],
      permissions: [],
      isPlatformAdmin: true,
      platformRole: platformUser.role,
    };

    return {
      accessToken: await this.signAccessToken(authUser),
      refreshToken: await this.signRefreshToken(authUser),
      user: authUser,
      accessTokenExpiresAt: this.accessTokenExpiresAt().toISOString(),
    };
  }

  async refresh(refreshToken: string): Promise<LoginResult> {
    const payload = await this.verifyRefreshToken(refreshToken);
    await this.sessionTokens.assertActive(payload.sub, refreshToken);

    const user = await this.loadUserById(payload.sub);
    const authUser = this.toAuthUser(user, payload.activeStoreId ?? user.tenantId);

    return {
      accessToken: await this.signAccessToken(authUser),
      refreshToken,
      user: authUser,
      accessTokenExpiresAt: this.accessTokenExpiresAt().toISOString(),
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const payload = await this.verifyRefreshToken(refreshToken);
    await this.sessionTokens.revoke(payload.sub, refreshToken);
    await this.accessAudit.record({
      actorUserId: payload.sub,
      targetUserId: payload.sub,
      storeId: payload.activeStoreId ?? payload.tenantId,
      eventType: AccessAuditEventType.LOGOUT,
      result: AccessAuditResult.SUCCESS,
    });
  }

  async requestPasswordReset(login: string) {
    await this.passwordReset.request(login);
    await this.accessAudit.record({
      eventType: AccessAuditEventType.PASSWORD_RESET_REQUESTED,
      result: AccessAuditResult.SUCCESS,
      metadata: { login },
    });
    return { accepted: true };
  }

  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    await this.passwordReset.confirm(token, newPassword);
    await this.accessAudit.record({
      eventType: AccessAuditEventType.PASSWORD_CHANGED,
      result: AccessAuditResult.SUCCESS,
    });
  }

  async changeActiveStore(
    user: AuthUser,
    storeId: string,
    refreshToken?: string
  ): Promise<LoginResult> {
    const allowedStoreIds = user.allowedStoreIds?.length ? user.allowedStoreIds : [user.tenantId];

    if (!user.isMaster && !user.isPlatformAdmin && !allowedStoreIds.includes(storeId)) {
      throw new ForbiddenException("Loja fora do escopo autorizado");
    }

    const updatedUser: AuthUser = {
      ...user,
      tenantId: storeId,
      activeStoreId: storeId,
    };

    if (refreshToken) {
      await this.sessionTokens.updateActiveStore(user.id, refreshToken, storeId);
    }

    return {
      accessToken: await this.signAccessToken(updatedUser),
      refreshToken: refreshToken ?? "",
      user: updatedUser,
      accessTokenExpiresAt: this.accessTokenExpiresAt().toISOString(),
    };
  }

  async verifyAccessToken(token: string): Promise<JwtPayload> {
    return this.jwtService.verifyAsync<JwtPayload>(token, {
      secret: this.accessSecret,
    });
  }

  async verifyRefreshToken(token: string): Promise<JwtPayload> {
    return this.jwtService.verifyAsync<JwtPayload>(token, {
      secret: this.refreshSecret,
    });
  }

  private async loadUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: true,
        storeAssignments: {
          where: { status: AccessProfileStatus.ACTIVE },
          include: {
            tenant: true,
            profile: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || user.status !== AccessUserStatus.ACTIVE || !user.tenant.active) {
      throw new UnauthorizedException("User is inactive");
    }

    return user;
  }

  private async signAccessToken(user: AuthUser): Promise<string> {
    return this.jwtService.signAsync(this.toPayload(user), {
      secret: this.accessSecret,
      expiresIn: "15m",
    });
  }

  private async signRefreshToken(user: AuthUser): Promise<string> {
    return this.jwtService.signAsync(this.toPayload(user), {
      secret: this.refreshSecret,
      expiresIn: "7d",
    });
  }

  private toPayload(user: AuthUser): JwtPayload {
    return {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      name: user.name,
      isMaster: user.isMaster,
      activeStoreId: user.activeStoreId,
      allowedStoreIds: user.allowedStoreIds,
      manageableStoreIds: user.manageableStoreIds,
      permissions: user.permissions,
      isPlatformAdmin: user.isPlatformAdmin,
      platformRole: user.platformRole,
    };
  }

  private toAuthUser(
    user: User & {
      storeAssignments: Array<{
        tenantId: string;
        canManageStoreAccess: boolean;
        profile: { permissions: Array<{ permission: { key: string } }> };
      }>;
    },
    activeStoreId: string
  ): AuthUser {
    const allowedStoreIds = [
      ...new Set([
        user.tenantId,
        ...user.storeAssignments.map((assignment) => assignment.tenantId),
      ]),
    ];

    return {
      id: user.id,
      tenantId: activeStoreId,
      role: user.role,
      email: user.email,
      name: user.name,
      isMaster: user.isMaster,
      activeStoreId,
      allowedStoreIds,
      manageableStoreIds: user.storeAssignments
        .filter((assignment) => assignment.canManageStoreAccess)
        .map((assignment) => assignment.tenantId),
      permissions: [
        ...new Set(
          user.storeAssignments.flatMap((assignment) =>
            assignment.profile.permissions.map((grant) => grant.permission.key)
          )
        ),
      ],
    };
  }

  private accessTokenExpiresAt(): Date {
    return new Date(Date.now() + 15 * 60 * 1000);
  }

  private get accessSecret(): string {
    return process.env.JWT_ACCESS_SECRET ?? "dev-access-secret";
  }

  private get refreshSecret(): string {
    return process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret";
  }
}
