import { describe, expect, it } from "vitest";
import { McpToolError } from "../server/mcp-context";
import { mapInventory } from "./inventory.tools";
import { mapMenuEngineering } from "./menu.tools";
import { mapPayables, resolveDueDateFilter, resolveNamed } from "./payables.tools";
import { mapSalesReport } from "./sales.tools";
import { percentual, ratio, reais, resolvePeriod, truncate } from "./tool-output";

const periodo = { inicio: "2026-09-01", fim: "2026-09-30", fuso: "America/Sao_Paulo", padraoAplicado: false };

describe("tool output helpers", () => {
  it("rounds money and percentages", () => {
    expect(reais("1234.567")).toBe(1234.57);
    expect(reais("abc")).toBe(0);
    expect(percentual(0.12345)).toBe(12.3);
    expect(ratio("25", "100")).toBe(25);
    expect(ratio("25", "0")).toBe(0);
  });

  it("truncates lists at 50 items", () => {
    const result = truncate(Array.from({ length: 60 }, (_, index) => index));
    expect(result.items).toHaveLength(50);
    expect(result).toMatchObject({ totalItens: 60, truncado: true });
    expect(truncate([1, 2])).toMatchObject({ totalItens: 2, truncado: false });
  });

  it("validates periods with the contract codes", () => {
    const fallback = { start: "2026-09-01", end: "2026-09-30" };
    expect(resolvePeriod({}, fallback)).toMatchObject({ padraoAplicado: true, inicio: "2026-09-01" });
    expect(resolvePeriod({ inicio: "2026-08-01", fim: "2026-10-31" }, fallback).inicio).toBe(
      "2026-08-01"
    );

    const codeOf = (args: { inicio?: string; fim?: string }) => {
      try {
        resolvePeriod(args, fallback);
        return null;
      } catch (error) {
        return (error as McpToolError).code;
      }
    };
    expect(codeOf({ inicio: "2026-09-30", fim: "2026-09-01" })).toBe("INVALID_PERIOD");
    expect(codeOf({ inicio: "2026-02-30", fim: "2026-03-01" })).toBe("INVALID_PERIOD");
    expect(codeOf({ inicio: "2026-01-01", fim: "2026-09-30" })).toBe("PERIOD_TOO_LONG");
    expect(codeOf({ inicio: "2026-08-01", fim: "2026-11-01" })).toBe("PERIOD_TOO_LONG");
  });
});

describe("mappers", () => {
  it("drops order-level data and keeps only aggregates in the sales summary", () => {
    const output = mapSalesReport(
      {
        summary: {
          orderCount: 0,
          grossRevenue: "0.00",
          acquiredNetRevenue: "0.00",
          releasedNetRevenue: "0.00",
          receivableNetAmount: "0.00",
          paymentFeeAmount: "0.00",
          averageTicket: "0.00",
        },
        daily: [],
        byChannel: [],
        byPaymentMethod: [],
        byPaymentInstitution: [],
        analytical: { items: [{ customerName: "Maria", customerPhone: "11999999999" }] },
        receivables: { pendingOrderCount: 0, receivableNetAmount: "0.00", nextExpectedReleaseDate: null },
        ifoodFinancial: {
          saleCount: 0,
          bagAmount: "0.00",
          customerPaidAmount: "0.00",
          ifoodReceivableAmount: "0.00",
          storeReceivedAmount: "0.00",
        },
      } as never,
      periodo,
      {}
    );

    expect(JSON.stringify(output)).not.toMatch(/Maria|11999999999|analytical|customer/);
    expect(output.semMovimento).toBe(true);
  });

  it("filters, sorts and counts menu engineering products", () => {
    const items = Array.from({ length: 55 }, (_, index) => ({
      productId: `p-${index}`,
      productName: `Produto ${index}`,
      volumeSold: index,
      revenue: String(index * 10),
      cmv: "1.00",
      grossProfit: "2.00",
      marginRate: 0.5,
      classification: index % 2 === 0 ? "STAR" : "DOG",
    }));
    const output = mapMenuEngineering(
      { insufficientData: false, averageVolume: 27, averageMarginRate: 0.5, items } as never,
      periodo,
      []
    );
    expect(output.produtos).toHaveLength(50);
    expect(output.produtos[0].produto).toBe("Produto 54");
    expect(output).toMatchObject({ totalItens: 55, truncado: true });
    expect(output.contagemPorClassificacao).toEqual({ STAR: 28, WORKHORSE: 0, PUZZLE: 0, DOG: 27 });

    const stars = mapMenuEngineering(
      { insufficientData: false, averageVolume: 27, averageMarginRate: 0.5, items } as never,
      periodo,
      ["STAR"]
    );
    expect(stars.produtos.every((product) => product.classificacao === "STAR")).toBe(true);
  });

  it("never exposes payable notes, document references or bank data", () => {
    const output = mapPayables(
      {
        items: [
          {
            description: "Aluguel",
            supplierName: "Imobiliaria",
            categoryName: "Aluguel",
            competenceDate: "2026-09-01",
            dreClassOverride: "VARIABLE_EXPENSE",
            effectiveDreClass: "VARIABLE_EXPENSE",
            dueDate: "2026-10-10",
            expectedAmount: "1000.00",
            paidAmount: "0.00",
            remainingAmount: "1000.00",
            status: "OPEN",
            documentReference: "CNPJ 12.345.678/0001-90",
            notes: "Agencia 0001 conta 1234",
            payments: [{ financialAccountName: "Banco X" }],
          },
        ],
        summary: {
          totalExpected: "1000.00",
          totalPaid: "0.00",
          totalRemaining: "1000.00",
          overdueAmount: "0.00",
          openCount: 1,
          overdueCount: 0,
        },
        total: 1,
      } as never,
      [],
      { ...periodo, criterio: "vencimento" },
      { status: [], categorias: [], fornecedores: [], mesCompetencia: null }
    );
    expect(JSON.stringify(output)).not.toMatch(/CNPJ|Agencia|conta 1234|Banco X/);
    expect(output.contas[0]).toEqual({
      descricao: "Aluguel",
      fornecedor: "Imobiliaria",
      categoria: "Aluguel",
      competencia: "2026-09-01",
      classificacaoDre: "VARIABLE_EXPENSE",
      classificacaoAjustada: true,
      vencimento: "2026-10-10",
      valorReais: 1000,
      pagoReais: 0,
      restanteReais: 1000,
      status: "OPEN",
    });
  });

  it("applies the default due-date window only without any date or competence", () => {
    const now = new Date(2026, 9, 2, 12);
    expect(resolveDueDateFilter({}, false, now)).toMatchObject({
      inicio: "2026-09-02",
      fim: "2026-11-01",
      padraoAplicado: true,
      criterio: "vencimento",
    });
    expect(resolveDueDateFilter({}, true, now)).toMatchObject({ inicio: null, fim: null, padraoAplicado: false });
    expect(resolveDueDateFilter({ inicio: "2026-10-01" }, false, now)).toMatchObject({ inicio: "2026-10-01", fim: null });
    expect(() => resolveDueDateFilter({ inicio: "2026-01-01", fim: "2026-12-31" }, false, now)).toThrow("92 dias");
  });

  it("resolves categories and suppliers by name or id, case and accent insensitive", () => {
    const options = [
      { id: "cat-1", name: "Água e Luz", active: true },
      { id: "cat-2", name: "Aluguel", active: true },
    ];
    expect(resolveNamed(["agua e luz", "cat-2"], options, "categoria")).toEqual({
      ids: ["cat-1", "cat-2"],
      names: ["Água e Luz", "Aluguel"],
    });
    expect(() => resolveNamed(["Marketing"], options, "categoria")).toThrow(
      "Categoria nao encontrada: Marketing. Opcoes: Água e Luz, Aluguel."
    );
    expect(resolveNamed([], options, "fornecedor")).toEqual({ ids: [], names: [] });
  });

  it("lists critical inventory first", () => {
    const output = mapInventory(
      [
        { ingredientName: "B", status: "OK", estimatedBalance: 5, minimumStock: 1, reservedOrConsumed: 0 },
        { ingredientName: "A", status: "BUY", estimatedBalance: 1, minimumStock: 2, reservedOrConsumed: 0 },
        { ingredientName: "C", status: "INSUFFICIENT", estimatedBalance: 0, minimumStock: 2, reservedOrConsumed: 1 },
      ] as never,
      []
    );
    expect(output.itens.map((item) => item.ingrediente)).toEqual(["C", "A", "B"]);
    expect(mapInventory([] as never, []).semMovimento).toBe(true);
  });
});
