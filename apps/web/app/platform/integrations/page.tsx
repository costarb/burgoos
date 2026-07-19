import { getMercadoPagoPlatformConfiguration, getPlatformAdminToken } from "../../../lib/api";
import { MercadoPagoPlatformConfigurationClient } from "./platform-integrations-client";

export const dynamic = "force-dynamic";

export default async function PlatformIntegrationsPage() {
  const token = await getPlatformAdminToken();
  const configuration = await getMercadoPagoPlatformConfiguration(token);
  return <MercadoPagoPlatformConfigurationClient token={token} initialValue={configuration} />;
}
