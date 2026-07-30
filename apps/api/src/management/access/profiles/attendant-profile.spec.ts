import { describe, expect, it } from "vitest";
import {
  ATTENDANT_PERMISSION_KEYS,
  ATTENDANT_PROFILE_NAME,
} from "./attendant-profile";

describe("default attendant profile", () => {
  it("contains operational permissions without sensitive administration", () => {
    expect(ATTENDANT_PROFILE_NAME).toBe("Atendente");
    expect(ATTENDANT_PERMISSION_KEYS).toEqual(expect.arrayContaining([
      "pos.capture",
      "tabs.manage",
      "orders.view",
      "kds.manage",
      "payments.charge",
      "payments.confirm-manual",
    ]));
    expect(ATTENDANT_PERMISSION_KEYS).not.toEqual(expect.arrayContaining([
      "pos.override-price",
      "payments.cancel",
      "payments.refund",
      "payments.reconcile",
      "payment-terminals.manage",
      "payment-exceptions.view",
    ]));
  });
});
