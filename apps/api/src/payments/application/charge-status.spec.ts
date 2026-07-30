import { describe, expect, it } from "vitest";
import { canTransitionChargeStatus, isActiveChargeStatus } from "./charge-status";

describe("payment charge transitions", () => {
  it("maps the automatic happy path", () => {
    expect(canTransitionChargeStatus("CREATED", "WAITING_CUSTOMER")).toBe(true);
    expect(canTransitionChargeStatus("WAITING_CUSTOMER", "PROCESSING")).toBe(true);
    expect(canTransitionChargeStatus("PROCESSING", "APPROVED")).toBe(true);
  });

  it("allows an unknown result to reconcile to a final state", () => {
    expect(canTransitionChargeStatus("PROCESSING", "UNKNOWN")).toBe(true);
    expect(canTransitionChargeStatus("UNKNOWN", "APPROVED")).toBe(true);
    expect(canTransitionChargeStatus("UNKNOWN", "DECLINED")).toBe(true);
  });

  it("identifies statuses that block a concurrent charge", () => {
    expect(isActiveChargeStatus("WAITING_CUSTOMER")).toBe(true);
    expect(isActiveChargeStatus("UNKNOWN")).toBe(true);
    expect(isActiveChargeStatus("APPROVED")).toBe(false);
  });
});
