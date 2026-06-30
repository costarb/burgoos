import React from "react";
import { getPricingAnalysis } from "../../../lib/api";
import { PricingClient } from "./pricing-client";

export const dynamic = "force-dynamic";

interface PricingPageProps {
  searchParams: {
    platformId?: string;
  };
}

export default async function PricingPage({ searchParams }: PricingPageProps) {
  const data = await getPricingAnalysis(searchParams.platformId);

  return (
    <PricingClient
      orderPlatforms={data.orderPlatforms}
      products={data.products}
      selectedPlatformId={data.selectedPlatformId}
    />
  );
}
