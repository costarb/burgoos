import { describe, expect, it } from "vitest";
import { effectiveDreClass, suggestDreClass } from "./dre-expense-class";

describe("DRE expense class", () => {
  it.each([
    ["Aluguel", "FIXED_COST"],
    ["Energia elétrica", "FIXED_COST"],
    ["Água", "FIXED_COST"],
    ["Salários", "FIXED_COST"],
    ["Contabilidade", "FIXED_COST"],
    ["Insumos", "EXCLUDED"],
    ["Matéria-prima", "EXCLUDED"],
    ["Taxas", "EXCLUDED"],
    ["Equipamentos", "EXCLUDED"],
    ["Prestador de Serviço", "VARIABLE_EXPENSE"],
    ["Marketing", "VARIABLE_EXPENSE"],
    ["Outros", "VARIABLE_EXPENSE"],
  ])("suggests %s as %s", (name, expected) => {
    expect(suggestDreClass(name)).toBe(expected);
  });

  it("uses the payable adjustment over the category", () => {
    expect(effectiveDreClass({ dreClassOverride: null, category: { dreClass: "VARIABLE_EXPENSE" } })).toBe(
      "VARIABLE_EXPENSE"
    );
    expect(effectiveDreClass({ dreClassOverride: "FIXED_COST", category: { dreClass: "VARIABLE_EXPENSE" } })).toBe(
      "FIXED_COST"
    );
  });
});
