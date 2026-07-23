import React from "react";
import { OrderConfirmation } from "../../../_components/order-confirmation";

interface Props { params: { orderId: string }; searchParams: { total?: string; whatsappUrl?: string } }
export const dynamic = "force-dynamic";

export default function DomainOrderConfirmationPage({ params, searchParams }: Props) {
  return <OrderConfirmation orderId={params.orderId} total={searchParams.total ?? "0.00"} whatsappUrl={searchParams.whatsappUrl ?? "/cardapio"} menuHref="/cardapio" />;
}
