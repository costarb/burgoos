import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { REQUIRED_PERMISSION_KEY } from "../src/auth/guards/require-permission.decorator";
import { CounterSalesController } from "../src/ordering/counter-sales/counter-sales.controller";
import { KdsController } from "../src/ordering/kds/kds.controller";
import { ServiceTabController } from "../src/ordering/tabs/service-tab.controller";
import { PaymentChargeController } from "../src/payments/payment-charge.controller";
import { PaymentTerminalController } from "../src/payments/payment-terminal.controller";

describe("attendant direct-route authorization", () => {
  it("protects POS, tabs and KDS with attendant operational permissions", () => {
    expect(classPermissions(CounterSalesController)).toContain("pos.capture");
    expect(classPermissions(ServiceTabController)).toContain("tabs.manage");
    expect(methodPermissions(KdsController, "snapshot")).toEqual(
      expect.arrayContaining(["kds.view", "kds.manage"]),
    );
  });

  it("separates charging from terminal administration and cancellation", () => {
    expect(methodPermissions(PaymentTerminalController, "list")).toContain("payments.charge");
    expect(methodPermissions(PaymentTerminalController, "sync")).toEqual([
      "payment-terminals.manage",
    ]);
    expect(methodPermissions(PaymentTerminalController, "enabled")).toEqual([
      "payment-terminals.manage",
    ]);
    expect(methodPermissions(PaymentChargeController, "cancel")).toEqual([
      "payments.cancel",
    ]);
  });
});

function classPermissions(controller: object) {
  return Reflect.getMetadata(REQUIRED_PERMISSION_KEY, controller) ?? [];
}

function methodPermissions(controller: { prototype: object }, method: string) {
  const handler = (controller.prototype as Record<string, object>)[method];
  if (!handler) throw new Error(`Handler ${method} not found`);
  return Reflect.getMetadata(REQUIRED_PERMISSION_KEY, handler) ?? [];
}
