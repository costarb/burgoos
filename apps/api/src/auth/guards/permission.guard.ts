import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AuthenticatedRequest } from "../../platform/auth/auth.types";
import { REQUIRED_PERMISSION_KEY } from "./require-permission.decorator";

@Injectable()
export class PermissionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const metadataPermissions = this.requiredPermissions(context);
    const required = metadataPermissions.length
      ? metadataPermissions
      : this.fromHeader(request.headers["x-required-permission"]);

    if (
      !required.length ||
      request.user.isMaster ||
      request.user.isPlatformAdmin ||
      request.user.role === UserRole.OWNER ||
      request.user.role === UserRole.ADMIN
    ) {
      return true;
    }

    if (required.some((permission) => request.user.permissions?.includes(permission))) {
      return true;
    }

    throw new ForbiddenException("Permissao insuficiente");
  }

  private fromHeader(required: string | string[] | undefined): string[] {
    if (!required) {
      return [];
    }

    const value = Array.isArray(required) ? required[0] : required;
    return value
      .split(",")
      .map((permission) => permission.trim())
      .filter(Boolean);
  }

  private requiredPermissions(context: ExecutionContext): string[] {
    return (
      Reflect.getMetadata(REQUIRED_PERMISSION_KEY, context.getHandler()) ??
      Reflect.getMetadata(REQUIRED_PERMISSION_KEY, context.getClass()) ??
      []
    );
  }
}
