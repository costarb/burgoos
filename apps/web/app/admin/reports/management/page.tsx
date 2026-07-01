import React from "react";
import { getManagementReport } from "../../../../lib/api";
import { ManagementReportClient } from "./management-report-client";

export const dynamic = "force-dynamic";

interface ManagementReportPageProps {
  searchParams: {
    start?: string;
    end?: string;
  };
}

export default async function ManagementReportPage({ searchParams }: ManagementReportPageProps) {
  const { token, report } = await getManagementReport({
    start: searchParams.start,
    end: searchParams.end,
  });

  return <ManagementReportClient initialReport={report} token={token} />;
}
