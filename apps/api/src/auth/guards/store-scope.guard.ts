import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { AuthenticatedRequest } from "../../platform/auth/auth.types";

@Injectable()
export class StoreScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const storeId = this.resolveStoreId(request);

    if (!storeId || request.user.isMaster || request.user.isPlatformAdmin) {
      return true;
    }

    const allowedStoreIds = request.user.allowedStoreIds?.length
      ? request.user.allowedStoreIds
      : [request.user.tenantId];

    if (allowedStoreIds.includes(storeId)) {
      return true;
    }

    throw new ForbiddenException("Loja fora do escopo autorizado");
  }

  private resolveStoreId(request: AuthenticatedRequest): string | undefined {
    const queryStoreId = request.query.storeId;

    if (typeof queryStoreId === "string") {
      return queryStoreId;
    }

    const body = request.body as { storeId?: unknown } | undefined;
    return typeof body?.storeId === "string" ? body.storeId : undefined;
  }
}
