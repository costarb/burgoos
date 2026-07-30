"use client";

import React from "react";
import { OrdersClient, OrdersClientProps } from "./orders-client";

export function KdsClient(props: OrdersClientProps) {
  return <OrdersClient {...props} />;
}
