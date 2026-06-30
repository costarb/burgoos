import { getAdminToken, getNotifications } from "../../../lib/api";
import { NotificationsClient } from "./notifications-client";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const token = await getAdminToken();
  const initialState = await getNotifications(token, { limit: 50 });

  return <NotificationsClient initialState={initialState} token={token} />;
}
