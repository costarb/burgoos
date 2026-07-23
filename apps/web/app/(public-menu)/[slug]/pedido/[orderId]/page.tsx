import React from "react";
import { OrderConfirmation } from "../../../_components/order-confirmation";

interface Props { params: { slug: string; orderId: string }; searchParams: { total?: string; whatsappUrl?: string } }
export const dynamic = "force-dynamic";

export default function OrderConfirmationPage({ params, searchParams }: Props) {
  return <OrderConfirmation orderId={params.orderId} total={searchParams.total ?? "0.00"} whatsappUrl={searchParams.whatsappUrl ?? `/${params.slug}`} menuHref={`/${params.slug}`} />;
}
