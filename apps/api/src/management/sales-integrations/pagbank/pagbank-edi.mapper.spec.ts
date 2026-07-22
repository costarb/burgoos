import { describe, expect, it } from "vitest";
import { PAGBANK_SALE_FIXTURES } from "../../../../test/fixtures/pagbank-edi/transactional";
import { mapPagBankMovement } from "./pagbank-edi.mapper";

describe("mapPagBankMovement", () => {
  it.each([
    ["credit", "CREDIT_CARD"],
    ["installment", "CREDIT_CARD"],
    ["pix", "PIX"],
    ["debit", "DEBIT_CARD"],
    ["boleto", "PIX_MANUAL"],
  ] as const)("normalizes %s sales", (fixture, method) => {
    const result = mapPagBankMovement(PAGBANK_SALE_FIXTURES[fixture]);
    expect(result.kind).toBe("SALE");
    expect(result.sale?.paymentMethod).toBe(method);
    expect(result.sale?.externalSaleId).toBeTruthy();
  });

  it.each(["cancellation", "chargeback"] as const)("does not import %s as a sale", (fixture) => {
    const result = mapPagBankMovement(PAGBANK_SALE_FIXTURES[fixture]);
    expect(result.kind).toBe("NON_SALE");
    expect(result.sale).toBeNull();
  });

  it("rejects unrecognized payment methods", () => {
    const result = mapPagBankMovement({
      ...PAGBANK_SALE_FIXTURES.credit,
      meio_pagamento: "UNKNOWN",
    });
    expect(result.rejectionCode).toBe("INVALID_SALE");
  });

  it.each(["8", "15"])(
    "maps PagBank v3.01 debit code %s using the receivable arrangement",
    (code) => {
      const result = mapPagBankMovement({
        ...PAGBANK_SALE_FIXTURES.debit,
        meio_pagamento: code,
        arranjo_ur: "DEBIT_MASTERCARD",
      });
      expect(result.sale?.paymentMethod).toBe("DEBIT_CARD");
      expect(result.rejectionCode).toBeUndefined();
    }
  );
});
