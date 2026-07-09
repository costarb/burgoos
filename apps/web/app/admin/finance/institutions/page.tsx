import React from "react";
import { getPaymentInstitutions } from "../../../../lib/api";
import { PaymentInstitutionsClient } from "./payment-institutions-client";

export const dynamic = "force-dynamic";

interface PaymentInstitutionsPageProps {
  searchParams?: {
    search?: string;
    active?: string;
  };
}

export default async function PaymentInstitutionsPage({
  searchParams,
}: PaymentInstitutionsPageProps) {
  const search = searchParams?.search?.trim() ?? "";
  const active =
    searchParams?.active === "true" || searchParams?.active === "false" ? searchParams.active : "";
  const { token, institutions } = await getPaymentInstitutions({ search, active });

  return (
    <PaymentInstitutionsClient
      initialFilters={{ active, search }}
      initialInstitutions={institutions}
      token={token}
    />
  );
}
