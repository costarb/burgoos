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

export type PurchaseUnitKind = "WEIGHT" | "VOLUME" | "COUNT" | "PACKAGE";

export interface FinancialConfiguration {
  id: string;
  taxRate: number;
  cardFeeRate: number;
  operationalLossRate: number;
  desiredMarginRate: number;
  averagePackagingCost: string;
  monthlyFixedCost: string;
  monthlyRevenueGoal: string;
  cmvWarningRate: number;
  netMarginGoalRate: number;
}

export interface FinancialConfigurationInput {
  taxRate: number;
  cardFeeRate: number;
  operationalLossRate: number;
  desiredMarginRate: number;
  averagePackagingCost: number;
  monthlyFixedCost: number;
  monthlyRevenueGoal: number;
  cmvWarningRate: number;
  netMarginGoalRate: number;
}

export interface PurchaseUnit {
  id: string;
  name: string;
  abbreviation: string;
  kind: PurchaseUnitKind;
  active: boolean;
}

export interface PurchaseUnitInput {
  name: string;
  abbreviation: string;
  kind: PurchaseUnitKind;
  active?: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  category: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: boolean;
}

export interface SupplierInput {
  name: string;
  category: string;
  contactName?: string;
  phone?: string;
  email?: string;
  notes?: string;
  active?: boolean;
}

export interface OrderPlatform {
  id: string;
  name: string;
  feeRate: number;
  paymentFeeRate: number;
  active: boolean;
}

export interface OrderPlatformInput {
  name: string;
  feeRate: number;
  paymentFeeRate?: number;
  active?: boolean;
}

export interface Ingredient {
  id: string;
  name: string;
  category: string;
  purchaseUnitId: string;
  supplierId: string | null;
  purchaseQuantity: number;
  purchaseCost: string;
  unitCost: string;
  currentStock: number;
  minimumStock: number;
  active: boolean;
}

export interface IngredientInput {
  name: string;
  category: string;
  purchaseUnitId: string;
  supplierId?: string;
  purchaseQuantity: number;
  purchaseCost: number;
  currentStock?: number;
  minimumStock?: number;
  active?: boolean;
}

export interface TechnicalSheetLine {
  id: string;
  ingredientId: string;
  ingredientName: string;
  quantityUsed: number;
  unitCostSnapshot: string;
  itemCost: string;
  isPackaging: boolean;
  notes: string | null;
}

export interface TechnicalSheet {
  productId: string;
  complete: boolean;
  ingredientCmv: string;
  lines: TechnicalSheetLine[];
}

export interface TechnicalSheetSummary {
  productId: string;
  complete: boolean;
  lineCount: number;
  ingredientCmv: string;
}

export interface TechnicalSheetLineInput {
  ingredientId: string;
  quantityUsed: number;
  isPackaging?: boolean;
  notes?: string;
}

export interface TechnicalSheetInput {
  lines: TechnicalSheetLineInput[];
}

export type ProductCostStatus = "OK" | "REVIEW_PRICE" | "MISSING_TECHNICAL_SHEET";

export interface ProductPricing {
  productId: string;
  productName: string;
  currentPrice: string;
  totalCmv: string;
  cmvRate: number;
  idealPrice: string;
  estimatedProfit: string;
  estimatedMarginRate: number;
  status: ProductCostStatus;
}

export interface ProductPricingList {
  products: ProductPricing[];
}

export type InventoryStatus = "OK" | "BUY" | "INSUFFICIENT";

export interface InventoryBalance {
  ingredientId: string;
  ingredientName: string;
  currentStock: number;
  reservedOrConsumed: number;
  manualEntries: number;
  estimatedBalance: number;
  minimumStock: number;
  status: InventoryStatus;
}

export type StockMovementType = "MANUAL_ENTRY" | "MANUAL_ADJUSTMENT";

export interface StockMovementInput {
  ingredientId: string;
  movementType: StockMovementType;
  quantity: number;
  reason?: string;
}
