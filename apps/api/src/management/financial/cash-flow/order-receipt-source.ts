import { OrderStatus, PaymentInstitution, Prisma } from "@prisma/client";
import { toMoneyString } from "../money";

export interface OrderReceiptEntry {
  sourceType: "ORDER_RECEIPT";
  sourceId: string;
  financialAccountId: string | null;
  paymentInstitutionId: string | null;
  paymentInstitution: PaymentInstitution | null;
  occurredAt: Date;
  description: string;
  amount: Prisma.Decimal;
  amountFormatted: string;
  realizationStatus: "REALIZED" | "PROJECTED";
}

export type CashFlowOrder = {
  id: string;
  status: OrderStatus;
  customerName: string;
  total: Prisma.Decimal;
  paymentInstitution: PaymentInstitution | null;
  paymentInstitutionId: string | null;
  paymentGrossAmount: Prisma.Decimal | null;
  paymentNetAmount: Prisma.Decimal | null;
  paymentReleaseExpectedAt: Date | null;
  createdAt: Date;
  deletedAt: Date | null;
};

export interface InstitutionAccountMap {
  byInstitutionId: Map<string, string>;
  byLegacyInstitution: Map<PaymentInstitution, string>;
}

export function mapOrderReceipts(
  orders: CashFlowOrder[],
  accountMap: InstitutionAccountMap,
  asOf: Date
): OrderReceiptEntry[] {
  return orders
    .filter((order) => order.status === OrderStatus.DELIVERED && !order.deletedAt)
    .map((order) => {
      const occurredAt = order.paymentReleaseExpectedAt ?? order.createdAt;
      const amount = acquiredNetAmountForOrder(order);

      return {
        sourceType: "ORDER_RECEIPT" as const,
        sourceId: order.id,
        financialAccountId:
          (order.paymentInstitutionId
            ? accountMap.byInstitutionId.get(order.paymentInstitutionId)
            : undefined) ??
          (order.paymentInstitution
            ? accountMap.byLegacyInstitution.get(order.paymentInstitution)
            : undefined) ??
          null,
        paymentInstitutionId: order.paymentInstitutionId,
        paymentInstitution: order.paymentInstitution,
        occurredAt,
        description: `Recebimento pedido ${order.customerName}`,
        amount,
        amountFormatted: toMoneyString(amount),
        realizationStatus: occurredAt <= asOf ? "REALIZED" : "PROJECTED",
      };
    });
}

export function acquiredNetAmountForOrder(order: CashFlowOrder): Prisma.Decimal {
  return order.paymentNetAmount ?? order.paymentGrossAmount ?? order.total;
}
