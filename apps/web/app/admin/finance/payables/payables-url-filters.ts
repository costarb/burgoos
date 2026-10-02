import type { PayablesFilters } from "@rrfive/types";

export interface PayablesSearchParams {
  [key: string]: string | string[] | undefined;
}

/** Filters that arrive in the URL, e.g. from the DRE category link. */
export function filtersFromSearchParams(
  searchParams: PayablesSearchParams = {}
): PayablesFilters {
  const list = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value : value ? [value] : []).filter(Boolean);
  const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
  const competenceMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(single(searchParams.competenceMonth))
    ? single(searchParams.competenceMonth)
    : "";

  return {
    start: "",
    end: "",
    statuses: [],
    categoryIds: list(searchParams.categoryId),
    supplierIds: [],
    competenceMonth,
    competenceIncludesDueDate:
      competenceMonth !== "" && single(searchParams.competenceIncludesDueDate) === "true",
  };
}
