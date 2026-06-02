import { Inject, Logger, UnauthorizedException } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UserRole } from "@prisma/client";
import { compare } from "bcryptjs";
import { PrismaService } from "../database/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { AuthUser, JwtPayload } from "./auth.types";

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(JwtService)
    private readonly jwtService: JwtService
  ) {}

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        tenant: true,
      },
    });

    if (!user || !(await compare(dto.password, user.passwordHash))) {
      this.logger.warn(`Rejected login for email=${dto.email}`);
      throw new UnauthorizedException("Invalid credentials");
    }

    if (!user.tenant.active) {
      this.logger.warn(`Rejected login for inactive tenant=${user.tenantId}`);
      throw new UnauthorizedException("Tenant is inactive");
    }

    const authUser: AuthUser = {
      id: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      name: user.name,
    };

    return {
      accessToken: await this.signAccessToken(authUser),
      refreshToken: await this.signRefreshToken(authUser),
      user: authUser,
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
      isPlatformAdmin: true,
      platformRole: platformUser.role,
    };

    return {
      accessToken: await this.signAccessToken(authUser),
      refreshToken: await this.signRefreshToken(authUser),
      user: authUser,
    };
  }

  async verifyAccessToken(token: string): Promise<JwtPayload> {
    return this.jwtService.verifyAsync<JwtPayload>(token, {
      secret: this.accessSecret,
    });
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
      isPlatformAdmin: user.isPlatformAdmin,
      platformRole: user.platformRole,
    };
  }

  private get accessSecret(): string {
    return process.env.JWT_ACCESS_SECRET ?? "dev-access-secret";
  }

  private get refreshSecret(): string {
    return process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret";
  }
}
