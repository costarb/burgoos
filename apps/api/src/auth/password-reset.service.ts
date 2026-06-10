import { Injectable } from "@nestjs/common";
import { AccessUserStatus, PasswordResetPurpose, PasswordResetTokenStatus } from "@prisma/client";
import { randomBytes } from "crypto";
import { PrismaService } from "../platform/database/prisma.service";
import { AuthCryptoService } from "./auth-crypto.service";

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: AuthCryptoService
  ) {}

  async request(
    login: string,
    purpose: PasswordResetPurpose = PasswordResetPurpose.PASSWORD_RESET
  ) {
    const user = await this.prisma.user.findUnique({
      where: { email: login },
      select: { id: true, status: true },
    });

    if (
      !user ||
      user.status === AccessUserStatus.INACTIVE ||
      user.status === AccessUserStatus.LOCKED
    ) {
      return null;
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 2);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        purpose,
        tokenHash: await this.crypto.hashSecret(token),
        expiresAt,
      },
    });

    return { token, expiresAt };
  }

  async confirm(token: string, newPassword: string): Promise<void> {
    const candidates = await this.prisma.passwordResetToken.findMany({
      where: {
        status: PasswordResetTokenStatus.ACTIVE,
        expiresAt: { gt: new Date() },
      },
    });

    for (const candidate of candidates) {
      if (!(await this.crypto.verifySecret(token, candidate.tokenHash))) {
        continue;
      }

      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: candidate.userId },
          data: {
            passwordHash: await this.crypto.hashSecret(newPassword),
            status: AccessUserStatus.ACTIVE,
          },
        }),
        this.prisma.passwordResetToken.update({
          where: { id: candidate.id },
          data: {
            status: PasswordResetTokenStatus.USED,
            usedAt: new Date(),
          },
        }),
      ]);

      return;
    }

    throw new Error("Token invalid, used or expired");
  }
}
