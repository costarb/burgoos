import { ForbiddenException, Injectable } from "@nestjs/common";
import { AuthUser } from "../platform/auth/auth.types";

@Injectable()
export class CurrentUserService {
  isMaster(user: AuthUser): boolean {
    return Boolean(user.isMaster || user.isPlatformAdmin);
  }

  assertMaster(user: AuthUser): void {
    if (!this.isMaster(user)) {
      throw new ForbiddenException("Acesso master necessario");
    }
  }

  assertStoreAccess(user: AuthUser, storeId: string): void {
    if (this.isMaster(user)) {
      return;
    }

    const allowedStoreIds = user.allowedStoreIds?.length ? user.allowedStoreIds : [user.tenantId];

    if (!allowedStoreIds.includes(storeId)) {
      throw new ForbiddenException("Loja fora do escopo autorizado");
    }
  }

  canManageStoreAccess(user: AuthUser, storeId: string): boolean {
    if (this.isMaster(user)) {
      return true;
    }

    return user.manageableStoreIds?.includes(storeId) ?? false;
  }
}
