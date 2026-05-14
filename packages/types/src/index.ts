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
