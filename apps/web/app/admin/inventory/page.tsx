import React from "react";
import { getInventoryBalances } from "../../../lib/api";
import { InventoryClient } from "./inventory-client";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const { token, balances, ingredients } = await getInventoryBalances();

  return <InventoryClient balances={balances} ingredients={ingredients} token={token} />;
}
