"use client";

import type { ReactNode } from "react";
import { readAuthSession } from "../../lib/auth-client";
import { AccessDenied } from "./access-denied";

interface PermissionGateProps {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGate({ permission, children, fallback }: PermissionGateProps) {
  const session = readAuthSession();
  const allowed = session?.user.isMaster || session?.permissions.includes(permission);

  if (!allowed) {
    return fallback ?? <AccessDenied />;
  }

  return <>{children}</>;
}
