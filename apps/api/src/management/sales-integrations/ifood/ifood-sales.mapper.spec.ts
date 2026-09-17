import { describe, expect, it } from "vitest";
import { ifoodSalesFixture } from "./__fixtures__/ifood-financial.fixtures";
import { IfoodFinancialSale } from "./ifood-financial.types";
import { mapIfoodSale, merchantDate } from "./ifood-sales.mapper";

const fixture = () => structuredClone(ifoodSalesFixture.sales[0]) as unknown as IfoodFinancialSale;

describe("mapIfoodSale", () => {
  it("maps a concluded sale, values and redacts restricted metadata", () => {
    const result = mapIfoodSale(fixture());
    expect(result).toMatchObject({
      kind: "SALE",
      externalSaleId: ifoodSalesFixture.sales[0].id,
      sale: { grossAmount: 50, netAmount: 42, paymentMethod: "PIX" },
    });
    expect(JSON.stringify(result.raw)).not.toContain("00000000000000");
    expect(JSON.stringify(result.raw)).not.toContain("redacted-fixture");
  });

  it("classifies cancelled and unknown statuses for review", () => {
    const cancelled = fixture();
    cancelled.currentStatus = "CANCELLED";
    expect(mapIfoodSale(cancelled)).toMatchObject({
      kind: "UNKNOWN",
      rejectionCode: "CANCELLED_SALE",
    });
    cancelled.currentStatus = "FUTURE_STATUS";
    expect(mapIfoodSale(cancelled)).toMatchObject({
      kind: "UNKNOWN",
      rejectionCode: "UNKNOWN_STATUS",
    });
  });

  it("preserves multiple raw methods and rejects a sale with only unknown methods", () => {
    const multiple = fixture();
    multiple.payments.methods.push({ method: "CASH", value: 10, liability: "STORE" });
    expect(mapIfoodSale(multiple).sale?.providerMethod).toBe("PIX,CASH");
    const unknown = fixture();
    unknown.payments.methods = [{ method: "FUTURE_PAY", value: 1 }];
    expect(mapIfoodSale(unknown)).toMatchObject({
      kind: "UNKNOWN",
      rejectionCode: "UNKNOWN_PAYMENT_METHOD",
    });
  });

  it("groups UTC instants by merchant timezone", () => {
    expect(merchantDate("2026-09-02T01:30:00.000Z", "America/Sao_Paulo")).toBe("2026-09-01");
  });

  it("keeps gross components, benefits, customer paid and sale balance separate", () => {
    const result = mapIfoodSale(fixture());
    expect(result.sale?.financial).toEqual({
      bagAmount: 50,
      deliveryFeeAmount: 8,
      serviceFeeAmount: 1,
      benefitsAmount: 5,
      customerPaidAmount: 54,
      saleBalanceAmount: 42,
      ifoodReceivableAmount: 54,
      storeReceivedAmount: 0,
    });
  });

  it("preserves each receiver, installment and unknown method without scalar collapse", () => {
    const sale = fixture();
    sale.payments.methods.push({
      method: "CASH",
      currency: "BRL",
      type: "OFFLINE",
      value: 10,
      liability: "STORE",
      installment: {
        maxInstallments: 2,
        installmentDetail: [
          { reference: "1", amount: 5, expectedPaymentDate: "2026-09-10" },
          { reference: "2", amount: 5, expectedPaymentDate: "2026-10-10" },
        ],
      },
    });
    sale.payments.methods.push({ method: "FUTURE_PAY", value: 1, liability: "STORE" });
    const result = mapIfoodSale(sale);
    expect(result.kind).toBe("SALE");
    expect(result.sale?.payments).toHaveLength(3);
    expect(result.sale?.payments?.[1]).toMatchObject({
      mappedMethod: "CASH",
      liability: "STORE",
      installments: [{ reference: "1", amount: 5 }, { reference: "2", amount: 5 }],
    });
    expect(result.sale?.payments?.[2]).toMatchObject({
      providerMethod: "FUTURE_PAY",
      mappedMethod: null,
    });
    expect(result.sale?.mappingState).toEqual({
      reviewRequired: true,
      unknownPaymentMethods: ["FUTURE_PAY"],
    });
    expect(result.sale?.financial).toMatchObject({
      ifoodReceivableAmount: 54,
      storeReceivedAmount: 11,
    });
  });
});
