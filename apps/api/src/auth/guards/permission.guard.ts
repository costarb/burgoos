import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { AuthenticatedRequest } from "../../platform/auth/auth.types";

@Injectable()
export class PermissionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const required = request.headers["x-required-permission"];

    if (!required || request.user.isMaster || request.user.isPlatformAdmin) {
      return true;
    }

    const requiredPermission = Array.isArray(required) ? required[0] : required;

    if (requiredPermission && request.user.permissions?.includes(requiredPermission)) {
      return true;
    }

    throw new ForbiddenException("Permissao insuficiente");
  }
}
