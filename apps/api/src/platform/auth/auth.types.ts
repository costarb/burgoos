import { PlatformUserRole, UserRole } from "@prisma/client";
import { Request } from "express";

export interface AuthUser {
  id: string;
  tenantId: string;
  role: UserRole;
  email: string;
  name: string;
  isMaster?: boolean;
  activeStoreId?: string | null;
  allowedStoreIds?: string[];
  manageableStoreIds?: string[];
  permissions?: string[];
  isPlatformAdmin?: boolean;
  platformRole?: PlatformUserRole;
}

export interface JwtPayload {
  sub: string;
  tenantId: string;
  role: UserRole;
  email: string;
  name: string;
  isMaster?: boolean;
  activeStoreId?: string | null;
  allowedStoreIds?: string[];
  manageableStoreIds?: string[];
  permissions?: string[];
  isPlatformAdmin?: boolean;
  platformRole?: PlatformUserRole;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}
