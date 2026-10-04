import { McpToolError } from "../server/mcp-context";

export interface NamedOption {
  id: string;
  name: string;
}

const NOT_FOUND_LABEL = {
  categoria: "Categoria nao encontrada",
  fornecedor: "Fornecedor nao encontrado",
  "conta financeira": "Conta financeira nao encontrada",
  produto: "Produto nao encontrado",
  integracao: "Integracao nao encontrada",
} as const;

export type NamedLabel = keyof typeof NOT_FOUND_LABEL;

export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function optionList(options: NamedOption[]): string {
  return (
    options
      .slice(0, 50)
      .map((item) => item.name)
      .join(", ") || "nenhuma cadastrada"
  );
}

/** Finds one option by id or name (case/accent-insensitive); unknown or ambiguous names fail. */
export function resolveOne<T extends NamedOption>(
  value: string,
  options: T[],
  label: NamedLabel
): T {
  const byId = options.find((item) => item.id === value);
  if (byId) return byId;
  const matches = options.filter((item) => normalizeName(item.name) === normalizeName(value));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new McpToolError(
      "INVALID_FILTER",
      `Mais de um(a) ${label} com o nome "${value}". Informe o id: ${matches
        .map((item) => `${item.name} (${item.id})`)
        .join(", ")}.`
    );
  }
  throw new McpToolError(
    "INVALID_FILTER",
    `${NOT_FOUND_LABEL[label]}: ${value}. Opcoes: ${optionList(options)}.`
  );
}

/** Resolves several names or ids at once, reporting every unknown value together. */
export function resolveMany(
  requested: string[],
  options: NamedOption[],
  label: NamedLabel
): { ids: string[]; names: string[] } {
  if (requested.length === 0) return { ids: [], names: [] };
  const matched = new Map<string, string>();
  const unknown: string[] = [];
  for (const value of requested) {
    const option = options.find(
      (item) => item.id === value || normalizeName(item.name) === normalizeName(value)
    );
    if (option) matched.set(option.id, option.name);
    else unknown.push(value);
  }
  if (unknown.length) {
    throw new McpToolError(
      "INVALID_FILTER",
      `${NOT_FOUND_LABEL[label]}: ${unknown.join(", ")}. Opcoes: ${optionList(options)}.`
    );
  }
  return { ids: [...matched.keys()], names: [...matched.values()] };
}
