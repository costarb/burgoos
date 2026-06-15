import { FulfillmentMethod, PaymentMethod } from "@prisma/client";

export interface ExternalOrderItemDraft {
  externalItemId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string | null;
}

export interface ExternalOrderDraft {
  provider: "IFOOD" | "CUSTOM";
  externalOrderId: string;
  externalMerchantId: string;
  externalStatus: string;
  mode: "DELIVERY" | "MERCHANT_DELIVERY" | "TAKEOUT" | "DINE_IN";
  timing: "IMMEDIATE" | "SCHEDULED";
  customerName: string;
  customerPhone: string | null;
  fulfillmentMethod: FulfillmentMethod;
  paymentMethod: PaymentMethod;
  total: number;
  deliveryAddress?: unknown;
  notes?: string | null;
  confirmationDeadlineAt?: Date | null;
  preparationStartAt?: Date | null;
  rawOrder: unknown;
  items: ExternalOrderItemDraft[];
}
