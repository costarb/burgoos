import {
  getBlingPlatformConfiguration,
  getMercadoPagoPlatformConfiguration,
  getPagBankPlatformConfiguration,
  getPlatformAdminToken,
} from "../../../lib/api";
import { PlatformIntegrationsClient } from "./platform-integrations-client";

export const dynamic = "force-dynamic";

export default async function PlatformIntegrationsPage() {
  const token = await getPlatformAdminToken();
  const [mercadoPago, pagBank, bling] = await Promise.all([
    getMercadoPagoPlatformConfiguration(token),
    getPagBankPlatformConfiguration(token),
    getBlingPlatformConfiguration(token),
  ]);
  return <PlatformIntegrationsClient bling={bling} token={token} mercadoPago={mercadoPago} pagBank={pagBank} />;
}
