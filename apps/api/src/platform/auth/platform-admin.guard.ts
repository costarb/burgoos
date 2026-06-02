import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { PlatformUserRole } from "@prisma/client";
import { AuthenticatedRequest, AuthUser } from "./auth.types";

export interface PlatformAuthUser extends AuthUser {
  platformRole?: PlatformUserRole;
  isPlatformAdmin?: boolean;
}

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user as PlatformAuthUser | undefined;

    if (!user?.isPlatformAdmin || user.platformRole !== PlatformUserRole.SUPER_ADMIN) {
      throw new ForbiddenException("Acesso restrito a administradores da plataforma");
    }

    return true;
  }
}
