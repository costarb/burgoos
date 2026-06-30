import { FulfillmentMethod, PaymentInstitution, PaymentMethod } from "@prisma/client";
import { CalculatedOrder } from "./order-calculator";

interface BuildWhatsAppLinkInput {
  tenantPhone: string;
  customerName: string;
  customerPhone: string;
  fulfillmentMethod: FulfillmentMethod;
  paymentMethod: PaymentMethod;
  paymentInstitution?: PaymentInstitution | null;
  order: CalculatedOrder;
  notes?: string;
}

const paymentLabels: Record<PaymentMethod, string> = {
  CASH: "Dinheiro",
  PIX_MANUAL: "PIX",
  CARD_ON_DELIVERY: "Cartao na entrega",
  DEBIT_CARD: "Debito",
  CREDIT_CARD: "Credito",
  VOUCHER: "Voucher",
  PIX: "PIX"
};

const fulfillmentLabels: Record<FulfillmentMethod, string> = {
  DELIVERY: "Delivery",
  PICKUP: "Retirada"
};

export function buildWhatsAppOrderLink(input: BuildWhatsAppLinkInput): string {
  const lines = [
    "Novo pedido BurgoOS",
    "",
    `Cliente: ${input.customerName}`,
    `Telefone: ${input.customerPhone}`,
    `Tipo: ${fulfillmentLabels[input.fulfillmentMethod]}`,
    `Pagamento: ${paymentLabels[input.paymentMethod]}`,
    "",
    "Itens:",
    ...input.order.items.map(
      (item) =>
        `${item.quantity}x ${item.productNameSnapshot} - R$ ${item.total.toFixed(2)}`
    ),
    "",
    `Total: R$ ${input.order.total.toFixed(2)}`
  ];

  if (input.notes) {
    lines.push("", `Observacoes: ${input.notes}`);
  }

  return `https://wa.me/${input.tenantPhone}?text=${encodeURIComponent(lines.join("\n"))}`;
}
