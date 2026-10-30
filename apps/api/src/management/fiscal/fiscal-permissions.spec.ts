import { describe, expect, it } from "vitest";
import { ACCESS_PERMISSIONS } from "../access/permissions/permission-catalog";
import { FISCAL_PERMISSIONS } from "./fiscal-permissions";

describe("fiscal permissions", () => {
  it("are declared once in the access catalog under the Fiscal area", () => {
    const keys = ACCESS_PERMISSIONS.map((permission) => permission.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of Object.values(FISCAL_PERMISSIONS)) {
      const entry = ACCESS_PERMISSIONS.find((permission) => permission.key === key);
      expect(entry?.area).toBe("Fiscal");
    }
  });

  it("marks configuration, emission and cancellation as sensitive", () => {
    const sensitive = new Set(
      ACCESS_PERMISSIONS.filter((permission) => permission.sensitive).map((permission) => permission.key)
    );
    expect(sensitive.has(FISCAL_PERMISSIONS.configure)).toBe(true);
    expect(sensitive.has(FISCAL_PERMISSIONS.issue)).toBe(true);
    expect(sensitive.has(FISCAL_PERMISSIONS.cancel)).toBe(true);
    expect(sensitive.has(FISCAL_PERMISSIONS.view)).toBe(false);
  });
});
