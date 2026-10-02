import { describe, expect, it } from "vitest";
import {
  GLOBAL_PREFIX,
  GLOBAL_PREFIX_EXCLUSIONS,
  resolveAppRole,
  shouldEnableSwagger,
} from "./config/bootstrap-policy";

describe("runtime bootstrap policy", () => {
  it.each(["api", "worker", "all"] as const)("resolves the %s role", (role) => {
    expect(resolveAppRole(role)).toBe(role);
  });

  it("defaults to the development-compatible all role", () => {
    expect(resolveAppRole(undefined)).toBe("all");
  });

  it("rejects unknown roles before starting a process", () => {
    expect(() => resolveAppRole("scheduler")).toThrow(/APP_ROLE/);
  });

  it("does not build the Swagger document in production", () => {
    expect(shouldEnableSwagger("production")).toBe(false);
    expect(shouldEnableSwagger("development")).toBe(true);
  });

  it("keeps discovery documents outside the api prefix", () => {
    expect(GLOBAL_PREFIX).toBe("api");
    expect(GLOBAL_PREFIX_EXCLUSIONS).toEqual([".well-known/(.*)"]);
  });
});
