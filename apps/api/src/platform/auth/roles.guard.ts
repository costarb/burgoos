import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AuthenticatedRequest } from "./auth.types";

@Injectable()
export class OrderMaintenanceRolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.user.role !== UserRole.OWNER && request.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Order maintenance requires owner or admin access");
    }

    return true;
  }
}
