import { Injectable, UnauthorizedException } from "@nestjs/common";
import { SessionTokenStatus } from "@prisma/client";
import { PrismaService } from "../platform/database/prisma.service";
import { AuthCryptoService } from "./auth-crypto.service";

@Injectable()
export class SessionTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: AuthCryptoService
  ) {}

  async create(
    userId: string,
    refreshToken: string,
    activeTenantId?: string | null,
    expiresAt?: Date
  ) {
    return this.prisma.sessionToken.create({
      data: {
        userId,
        activeTenantId: activeTenantId ?? null,
        refreshTokenHash: await this.crypto.hashSecret(refreshToken),
        expiresAt: expiresAt ?? this.defaultRefreshExpiresAt(),
      },
    });
  }

  async assertActive(userId: string, refreshToken: string) {
    const sessions = await this.prisma.sessionToken.findMany({
      where: {
        userId,
        status: SessionTokenStatus.ACTIVE,
        expiresAt: { gt: new Date() },
      },
    });

    for (const session of sessions) {
      if (await this.crypto.verifySecret(refreshToken, session.refreshTokenHash)) {
        return session;
      }
    }

    throw new UnauthorizedException("Refresh token invalid, revoked or expired");
  }

  async revoke(userId: string, refreshToken: string): Promise<void> {
    const session = await this.assertActive(userId, refreshToken);

    await this.prisma.sessionToken.update({
      where: { id: session.id },
      data: {
        status: SessionTokenStatus.REVOKED,
        revokedAt: new Date(),
      },
    });
  }

  async updateActiveStore(userId: string, refreshToken: string, activeTenantId: string) {
    const session = await this.assertActive(userId, refreshToken);

    return this.prisma.sessionToken.update({
      where: { id: session.id },
      data: { activeTenantId },
    });
  }

  private defaultRefreshExpiresAt(): Date {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    return expiresAt;
  }
}
