import { describe, expect, it } from "vitest";
import { ACCESS_PERMISSIONS } from "./permission-catalog";

describe("POS permission catalog", () => {
  it("declares every operational permission exactly once", () => {
    const expected = [
      "pos.capture",
      "pos.override-price",
      "tabs.view",
      "tabs.manage",
      "kds.view",
      "kds.manage",
      "payments.charge",
      "payments.confirm-manual",
      "payments.cancel",
      "payments.refund",
      "payments.reconcile",
      "payment-terminals.manage",
      "payment-exceptions.view",
    ];
    const keys = ACCESS_PERMISSIONS.map((permission) => permission.key);

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(expect.arrayContaining(expected));
  });

  it("marks price override and sensitive payment actions as sensitive", () => {
    const sensitive = new Set(
      ACCESS_PERMISSIONS.filter((permission) => permission.sensitive).map(
        (permission) => permission.key
      )
    );

    expect(sensitive.has("pos.override-price")).toBe(true);
    expect(sensitive.has("payments.refund")).toBe(true);
    expect(sensitive.has("payment-terminals.manage")).toBe(true);
  });
});
