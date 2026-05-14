export type OrderStatus = "PENDING" | "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELLED";

export type FulfillmentMethod = "DELIVERY" | "PICKUP";

export type PaymentMethod = "CASH" | "PIX_MANUAL" | "CARD_ON_DELIVERY";

export interface PublicMenuProduct {
  id: string;
  name: string;
  description: string;
  price: string;
  imageUrl: string | null;
}

export interface PublicMenuCategory {
  id: string;
  name: string;
  products: PublicMenuProduct[];
}

export interface PublicMenu {
  tenant: {
    name: string;
    slug: string;
    isOpen: boolean;
  };
  categories: PublicMenuCategory[];
}

export interface CartItemInput {
  productId: string;
  quantity: number;
}

export interface CreatePublicOrderInput {
  customerName: string;
  customerPhone: string;
  fulfillmentMethod: FulfillmentMethod;
  paymentMethod: PaymentMethod;
  deliveryAddress?: Record<string, unknown>;
  notes?: string;
  items: CartItemInput[];
}

export interface CreatedOrderItem {
  id: string;
  productId: string;
  productNameSnapshot: string;
  quantity: number;
  unitPrice: string;
  total: string;
}

export interface CreatedOrder {
  id: string;
  status: OrderStatus;
  total: string;
  customerName: string;
  customerPhone: string;
  fulfillmentMethod: FulfillmentMethod;
  paymentMethod: PaymentMethod;
  items: CreatedOrderItem[];
  whatsappUrl: string;
}

export interface AdminOrderItem {
  id: string;
  productId: string;
  productNameSnapshot: string;
  quantity: number;
  unitPrice: string;
  total: string;
}

export interface AdminOrder {
  id: string;
  status: OrderStatus;
  total: string;
  customerName: string;
  customerPhone: string;
  fulfillmentMethod: FulfillmentMethod;
  paymentMethod: PaymentMethod;
  notes: string | null;
  createdAt?: string;
  items: AdminOrderItem[];
}
