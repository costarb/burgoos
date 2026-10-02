import type { DreExpenseClass } from "@rrfive/types";

export const DRE_CLASS_OPTIONS: Array<{ value: DreExpenseClass; label: string; description: string }> = [
  {
    value: "FIXED_COST",
    label: "Custo fixo",
    description: "Entra em Custos fixos no DRE (aluguel, energia, salarios, contador).",
  },
  {
    value: "VARIABLE_EXPENSE",
    label: "Despesa variavel",
    description: "Entra em Despesas variaveis no DRE (prestadores pontuais, marketing, manutencao).",
  },
  {
    value: "EXCLUDED",
    label: "Fora do DRE",
    description: "Nao entra no DRE: insumos (ja no CMV), taxas dos pedidos ou investimentos.",
  },
];

export function dreClassLabel(value: DreExpenseClass): string {
  return DRE_CLASS_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export const DRE_CLASS_BADGE: Record<DreExpenseClass, string> = {
  FIXED_COST: "bg-indigo-100 text-indigo-800",
  VARIABLE_EXPENSE: "bg-sky-100 text-sky-800",
  EXCLUDED: "bg-slate-200 text-slate-700",
};
