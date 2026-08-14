import { describe, expect, it } from "vitest";

import { RuntimeRoleService } from "../../config/runtime-role.service";
import { BackgroundJobRegistry, type RuntimeBackgroundJobHandler } from "./background-job.registry";

describe("BackgroundJobRegistry", () => {
  it.each([
    ["api", false],
    ["worker", true],
    ["all", true],
  ] as const)("uses role %s consumer policy", (role, expected) => {
    const registry = new BackgroundJobRegistry({ consumesBackgroundJobs: role !== "api" } as RuntimeRoleService);
    expect(registry.consumerEnabled).toBe(expected);
  });

  it("rejects duplicate handlers", () => {
    const registry = new BackgroundJobRegistry({ consumesBackgroundJobs: true } as RuntimeRoleService);
    const handler = { type: "RETENTION", execute: async () => ({}) } satisfies RuntimeBackgroundJobHandler;
    registry.register(handler);
    expect(() => registry.register(handler)).toThrow("Duplicate background job handler: RETENTION");
  });

  it("resolves registered handlers and rejects missing ones", () => {
    const registry = new BackgroundJobRegistry({ consumesBackgroundJobs: true } as RuntimeRoleService);
    const handler = { type: "RETENTION", execute: async () => ({}) } satisfies RuntimeBackgroundJobHandler;
    registry.register(handler);
    expect(registry.resolve("RETENTION")).toBe(handler);
    expect(() => registry.resolve("EXPORT")).toThrow("No background job handler");
  });
});
