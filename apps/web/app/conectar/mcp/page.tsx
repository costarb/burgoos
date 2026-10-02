import React from "react";
import { McpConsentClient } from "./mcp-consent-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Conectar assistente de IA - RRFive OS",
  robots: { index: false, follow: false },
};

export default function McpConsentPage() {
  return <McpConsentClient />;
}
