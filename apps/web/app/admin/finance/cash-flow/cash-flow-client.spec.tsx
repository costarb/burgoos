import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CashFlowClient } from "./cash-flow-client";

vi.mock("./cash-movement-dialog", () => ({ CashMovementDialog: () => null }));
vi.mock("./financial-account-dialog", () => ({ FinancialAccountDialog: () => null }));

describe("CashFlowClient", () => {
  it("uses the shared account multi-select in position and statement filters", () => {
    const html = renderToStaticMarkup(
      <CashFlowClient
        initialAccounts={
          [
            { id: "account-1", name: "Caixa", active: true },
            { id: "account-2", name: "Banco", active: true },
          ] as never
        }
        initialCategories={[]}
        initialInstitutions={[]}
        initialMovements={[]}
        initialPosition={{
          asOf: "2026-09-02",
          projectionEnd: "2026-10-02",
          currentBalance: "0.00",
          receivableAmount: "0.00",
          payableAmount: "0.00",
          projectedBalance: "0.00",
          negativeBalanceDetected: false,
          accounts: [],
          ledger: [],
          projection: [],
          timeline: [],
        }}
        initialStatement={{
          start: "2026-08-02",
          end: "2026-09-02",
          financialAccountId: null,
          financialAccountIds: [],
          openingBalance: "0.00",
          closingBalance: "0.00",
          totalCredit: "0.00",
          totalDebit: "0.00",
          netAmount: "0.00",
          days: [],
        }}
        token="token"
      />
    );

    expect(html).toContain("Contas da posição de caixa: Todas as contas");
    expect(html).toContain("Contas do extrato de caixa: Todas as contas");
    expect(html.match(/aria-haspopup="listbox"/g)).toHaveLength(2);
  });
});
