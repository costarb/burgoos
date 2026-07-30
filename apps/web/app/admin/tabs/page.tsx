import { getServiceTab, getServiceTabs, getShiftCloseSummary } from "../../../lib/api";
import { TabsClient } from "./tabs-client";
import { ShiftClosePanel } from "./shift-close-panel";

export default async function TabsPage() {
  const [tabs, summary] = await Promise.all([getServiceTabs(), getShiftCloseSummary()]);
  const selected = tabs[0] ? await getServiceTab(tabs[0].id) : null;
  return (
    <>
      <ShiftClosePanel initialSummary={summary} />
      <TabsClient initialSelected={selected} initialTabs={tabs} />
    </>
  );
}
