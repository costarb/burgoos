import { getAccessAudit } from "../../../lib/api";
import { AccessAuditClient } from "./access-audit-client";

export const dynamic = "force-dynamic";

export default async function AccessAuditPage() {
  const { events, stores } = await getAccessAudit();

  return <AccessAuditClient events={events} stores={stores} />;
}
