import { UserRole } from "@prisma/client";
import { Request } from "express";

export interface AuthUser {
  id: string;
  tenantId: string;
  role: UserRole;
  email: string;
  name: string;
}

export interface JwtPayload {
  sub: string;
  tenantId: string;
  role: UserRole;
  email: string;
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}
