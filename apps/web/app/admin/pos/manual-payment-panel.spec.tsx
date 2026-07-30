import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  calculateCashChange,
  ManualPaymentPanel,
} from "./manual-payment-panel";

describe("ManualPaymentPanel", () => {
  it("calculates cash change without floating point leakage", () => {
    expect(calculateCashChange("73.00", "100,00")).toBe("27.00");
    expect(calculateCashChange("73.00", "50.00")).toBeNull();
  });

  it("renders institution and payment method controls", () => {
    const html = renderToStaticMarkup(
      <ManualPaymentPanel
        amount="73.00"
        targetId="8057761f-7323-42ee-ae43-aef0e075e495"
        targetType="ORDER"
      />,
    );
    expect(html).toContain("Registrar pagamento manual");
    expect(html).toContain("Instituição");
    expect(html).toContain("Forma de pagamento");
    expect(html).toContain("Confirmar pagamento de R$ 73.00");
  });
});
