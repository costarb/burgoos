import { getAccessProfiles } from "../../../lib/api";
import { AccessProfilesClient } from "./access-profiles-client";

export const dynamic = "force-dynamic";

export default async function AccessProfilesPage() {
  const { token, profiles, permissions, stores } = await getAccessProfiles();

  return (
    <AccessProfilesClient
      permissions={permissions}
      profiles={profiles}
      stores={stores}
      token={token}
    />
  );
}
