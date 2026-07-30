import { describe, expect, it } from "vitest";
import { canTransitionTabStatus } from "./tab-status";

describe("service tab transitions", () => {
  it("moves an open tab through checkout to paid", () => {
    expect(canTransitionTabStatus("OPEN", "CHECKOUT_PENDING")).toBe(true);
    expect(canTransitionTabStatus("CHECKOUT_PENDING", "PAID")).toBe(true);
  });

  it("allows an authorized checkout reopen without reopening paid tabs", () => {
    expect(canTransitionTabStatus("CHECKOUT_PENDING", "OPEN")).toBe(true);
    expect(canTransitionTabStatus("PAID", "OPEN")).toBe(false);
  });
});
