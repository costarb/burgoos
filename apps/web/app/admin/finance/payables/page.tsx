import { getPayables } from "../../../../lib/api";
import { PayablesClient } from "./payables-client";
import { filtersFromSearchParams, PayablesSearchParams } from "./payables-url-filters";

export const dynamic = "force-dynamic";

interface PayablesPageProps {
  searchParams?: PayablesSearchParams;
}

export default async function PayablesPage({ searchParams }: PayablesPageProps) {
  const initialFilters = filtersFromSearchParams(searchParams);
  const { token, payables, options } = await getPayables(initialFilters);

  return (
    <PayablesClient
      initialFilters={initialFilters}
      initialPayables={payables}
      options={options}
      token={token}
    />
  );
}
