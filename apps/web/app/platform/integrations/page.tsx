import {
  getMercadoPagoPlatformConfiguration,
  getPagBankPlatformConfiguration,
  getPlatformAdminToken,
} from "../../../lib/api";
import { PlatformIntegrationsClient } from "./platform-integrations-client";

export const dynamic = "force-dynamic";

export default async function PlatformIntegrationsPage() {
  const token = await getPlatformAdminToken();
  const [mercadoPago, pagBank] = await Promise.all([
    getMercadoPagoPlatformConfiguration(token),
    getPagBankPlatformConfiguration(token),
  ]);
  return <PlatformIntegrationsClient token={token} mercadoPago={mercadoPago} pagBank={pagBank} />;
}
