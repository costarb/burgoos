import { describe, expect, it } from "vitest";
import { canTransitionOrderStatus } from "./order-status";

describe("order production transitions", () => {
  it("supports pickup preparation through ready and delivered", () => {
    expect(canTransitionOrderStatus("PENDING", "PREPARING", "PICKUP")).toBe(true);
    expect(canTransitionOrderStatus("PREPARING", "READY", "PICKUP")).toBe(true);
    expect(canTransitionOrderStatus("READY", "DELIVERED", "PICKUP")).toBe(true);
  });

  it("only offers shipped for delivery orders", () => {
    expect(canTransitionOrderStatus("READY", "SHIPPED", "DELIVERY")).toBe(true);
    expect(canTransitionOrderStatus("READY", "SHIPPED", "PICKUP")).toBe(false);
  });

  it("keeps terminal states immutable", () => {
    expect(canTransitionOrderStatus("DELIVERED", "PREPARING", "PICKUP")).toBe(false);
    expect(canTransitionOrderStatus("CANCELLED", "PENDING", "DELIVERY")).toBe(false);
  });
});
