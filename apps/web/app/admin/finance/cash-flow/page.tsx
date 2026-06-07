import { getCashPosition, getCashStatement, listCashMovements } from "../../../../lib/api";
import { CashFlowClient } from "./cash-flow-client";

export const dynamic = "force-dynamic";

export default async function CashFlowPage() {
  const today = new Date().toISOString().slice(0, 10);
  const statementStart = addDays(new Date(), -30).toISOString().slice(0, 10);
  const projectionEnd = addDays(new Date(), 30).toISOString().slice(0, 10);
  const { token, position, accounts, categories } = await getCashPosition({
    asOf: today,
    projectionEnd,
  });
  const [movements, statement] = await Promise.all([
    listCashMovements(token, { start: today, end: today }),
    getCashStatement(token, { start: statementStart, end: today }),
  ]);

  return (
    <CashFlowClient
      initialAccounts={accounts}
      initialCategories={categories}
      initialMovements={movements}
      initialPosition={position}
      initialStatement={statement}
      token={token}
    />
  );
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}
