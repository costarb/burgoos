import type { AppRole } from "./runtime-role.service";

export function resolveAppRole(value: string | undefined): AppRole {
  const role = value?.trim().toLowerCase() || "all";
  if (role !== "api" && role !== "worker" && role !== "all") {
    throw new Error("APP_ROLE must be one of: api, worker, all");
  }
  return role;
}

export function shouldEnableSwagger(nodeEnv: string | undefined): boolean {
  return nodeEnv !== "production";
}
