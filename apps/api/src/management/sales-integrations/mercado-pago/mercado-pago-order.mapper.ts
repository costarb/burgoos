import { MercadoPagoOrder } from "./mercado-pago.types";

export const MERCADO_PAGO_POINT_ORDER_CAPABILITY = false;

export interface DeferredMercadoPagoPointOrder {
  providerOrderId: string;
  status: string | null;
  raw: MercadoPagoOrder;
  mappingEnabled: false;
}

export function describeDeferredPointOrder(order: MercadoPagoOrder): DeferredMercadoPagoPointOrder {
  return {
    providerOrderId: order.id,
    status: order.status ?? null,
    raw: order,
    mappingEnabled: false,
  };
}
