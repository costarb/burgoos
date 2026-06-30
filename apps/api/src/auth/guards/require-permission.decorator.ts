import { SetMetadata } from "@nestjs/common";

export const REQUIRED_PERMISSION_KEY = "requiredPermission";

export function RequirePermission(...permissions: string[]) {
  return SetMetadata(REQUIRED_PERMISSION_KEY, permissions);
}
