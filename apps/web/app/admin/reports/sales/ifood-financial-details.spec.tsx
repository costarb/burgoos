import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IfoodFinancialDetails } from "./ifood-financial-details";

describe("IfoodFinancialDetails", () => {
  it("labels gross, net, receivers, multiple methods, installments and unknown mappings", () => {
    const html = renderToStaticMarkup(
      <IfoodFinancialDetails
        detail={{
          status: "CONCLUDED",
          bagAmount: "50.00",
          deliveryFeeAmount: "8.00",
          serviceFeeAmount: "1.00",
          benefitsAmount: "5.00",
          customerPaidAmount: "54.00",
          saleBalanceAmount: "42.00",
          ifoodReceivableAmount: "44.00",
          storeReceivedAmount: "10.00",
          payments: [
            {
              providerMethod: "PIX",
              mappedMethod: "PIX",
              liability: "IFOOD",
              amount: "44.00",
              currency: "BRL",
              brand: null,
              installmentCount: 0,
              installments: [],
            },
            {
              providerMethod: "FUTURE_PAY",
              mappedMethod: null,
              liability: "STORE",
              amount: "10.00",
              currency: "BRL",
              brand: null,
              installmentCount: 1,
              installments: [
                {
                  reference: "1",
                  amount: "10.00",
                  expectedPaymentDate: "2026-09-10",
                  status: "PENDING",
                },
              ],
            },
          ],
        }}
      />
    );
    expect(html).toContain("Cesta bruta");
    expect(html).toContain("Saldo da venda");
    expect(html).toContain("Recebivel iFood");
    expect(html).toContain("Recebido pela loja");
    expect(html).toContain("recebedor IFOOD");
    expect(html).toContain("Revisar: FUTURE_PAY");
    expect(html).toContain("Parcela 1");
  });
});
