import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthenticatedRequest, AuthUser } from "./auth.types";
import { AuthService } from "./auth.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const payload = await this.verifyToken(token);
    const user: AuthUser = {
      id: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
      email: payload.email,
      name: payload.name,
      isMaster: payload.isMaster,
      activeStoreId: payload.activeStoreId,
      allowedStoreIds: payload.allowedStoreIds,
      manageableStoreIds: payload.manageableStoreIds,
      permissions: payload.permissions,
      isPlatformAdmin: payload.isPlatformAdmin,
      platformRole: payload.platformRole,
    };

    request.user = user;

    if (user.isPlatformAdmin && this.isStoreScopedRequest(request)) {
      throw new ForbiddenException("Use as telas de plataforma para administrar lojas e usuarios");
    }

    return true;
  }

  private extractBearerToken(header: string | undefined): string | null {
    if (!header) {
      return null;
    }

    const [type, token] = header.split(" ");
    if (type !== "Bearer" || !token) {
      return null;
    }

    return token;
  }

  private async verifyToken(token: string) {
    try {
      return await this.authService.verifyAccessToken(token);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid token";
      const name = error instanceof Error ? error.name : "";

      if (name === "TokenExpiredError" || message.includes("jwt expired")) {
        throw new UnauthorizedException("Sessao expirada");
      }

      throw new UnauthorizedException("Sessao invalida");
    }
  }

  private isStoreScopedRequest(request: AuthenticatedRequest): boolean {
    const path = request.originalUrl ?? request.url ?? "";
    return path.startsWith("/api/admin/") || path === "/api/admin";
  }
}
