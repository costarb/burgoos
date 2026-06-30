import { getPayables } from "../../../../lib/api";
import { PayablesClient } from "./payables-client";

export const dynamic = "force-dynamic";

export default async function PayablesPage() {
  const { token, payables, options } = await getPayables();

  return <PayablesClient initialPayables={payables} options={options} token={token} />;
}
