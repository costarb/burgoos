import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AuthenticatedRequest } from "./auth.types";

@Injectable()
export class OrderMaintenanceRolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (
      request.user.role !== UserRole.OWNER &&
      request.user.role !== UserRole.ADMIN &&
      !request.user.permissions?.includes("orders.manage")
    ) {
      throw new ForbiddenException("Order maintenance requires owner or admin access");
    }

    return true;
  }
}

@Injectable()
export class FinancialManagementRolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (
      request.user.role !== UserRole.OWNER &&
      request.user.role !== UserRole.ADMIN &&
      !request.user.permissions?.some((permission) =>
        ["finance.view", "finance.manage"].includes(permission)
      )
    ) {
      throw new ForbiddenException(
        "Gestao financeira requer acesso de proprietario, administrador ou permissao financeira"
      );
    }

    return true;
  }
}
