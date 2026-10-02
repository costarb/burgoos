import { DreExpenseClass } from "@prisma/client";

export const DRE_EXPENSE_CLASS_LABELS: Record<DreExpenseClass, string> = {
  FIXED_COST: "Custo fixo",
  VARIABLE_EXPENSE: "Despesa variavel",
  EXCLUDED: "Fora do DRE",
};

/**
 * Keyword lists of the initial classification. Keep in sync with the backfill of migration
 * 20261003090000_dre_expense_class.
 */
const EXCLUDED_PATTERN =
  /(insumo|mercadoria|materia prima|materia-prima|taxa|equipamento|investimento|emprestimo|financiamento|retirada|distribuicao)/;
const FIXED_PATTERN =
  /(aluguel|energia|luz|agua|internet|telefone|salario|folha|contab|contador|seguro|condominio|iptu|sistema|software|assinatura)/;

/** Suggested DRE class for a category name (accent and case insensitive). */
export function suggestDreClass(name: string): DreExpenseClass {
  const normalized = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  if (EXCLUDED_PATTERN.test(normalized)) return DreExpenseClass.EXCLUDED;
  if (FIXED_PATTERN.test(normalized)) return DreExpenseClass.FIXED_COST;
  return DreExpenseClass.VARIABLE_EXPENSE;
}

/** The payable's own adjustment wins; otherwise it follows its category. */
export function effectiveDreClass(payable: {
  dreClassOverride: DreExpenseClass | null;
  category: { dreClass: DreExpenseClass };
}): DreExpenseClass {
  return payable.dreClassOverride ?? payable.category.dreClass;
}
