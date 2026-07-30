import type {
  AdminOrder,
  FulfillmentMethod,
  OrderStatus,
  PaymentInstitution,
  PaymentMethod,
} from "./index";

export type OrderSource = "LEGACY" | "COUNTER" | "PUBLIC_MENU" | "IFOOD" | "IMPORT" | "API";
export type ServiceTabStatus = "OPEN" | "CHECKOUT_PENDING" | "PAID" | "CANCELLED";
export type OrderPaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "REFUNDED" | "EXCEPTION";
export type ItemModificationType = "REMOVE_INGREDIENT" | "ADD_COMPLEMENT";

export interface PosCatalogIngredient {
  id: string;
  name: string;
  removable: boolean;
}

export interface PosCatalogComplement {
  id: string;
  name: string;
  description: string | null;
  price: string;
  maxQuantity: number;
  active: boolean;
}

export interface PosCatalogProduct {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: string;
  imageUrl: string | null;
  active: boolean;
  ingredients: PosCatalogIngredient[];
  complements: PosCatalogComplement[];
}

export interface PosCatalogCategory {
  id: string;
  name: string;
  sortOrder: number;
  products: PosCatalogProduct[];
}

export interface PosCatalog {
  categories: PosCatalogCategory[];
  generatedAt: string;
}

export interface CounterOrderItemModificationInput {
  type: ItemModificationType;
  referenceId: string;
  quantity: number;
}

export interface CounterOrderItemInput {
  productId: string;
  quantity: number;
  modifications?: CounterOrderItemModificationInput[];
  chargedUnitPrice?: string;
  priceOverrideReason?: string;
  notes?: string;
}

export interface CreateCounterOrderInput {
  serviceTabId?: string;
  customerName?: string;
  customerPhone?: string;
  fulfillmentMethod: FulfillmentMethod;
  notes?: string;
  releaseToKds?: boolean;
  items: CounterOrderItemInput[];
}

export interface UpdateCounterOrderInput {
  expectedVersion: number;
  customerName?: string;
  customerPhone?: string;
  fulfillmentMethod: FulfillmentMethod;
  notes?: string;
  items: CounterOrderItemInput[];
}

export interface PosOrderItemModification {
  id: string;
  type: ItemModificationType;
  referenceId: string;
  nameSnapshot: string;
  quantity: number;
  unitPriceDelta: string;
  totalPriceDelta: string;
}

export interface PosOrderItem {
  id: string;
  productId: string;
  productNameSnapshot: string;
  quantity: number;
  baseUnitPrice: string;
  calculatedUnitPrice: string;
  chargedUnitPrice: string;
  total: string;
  manualAdjustmentAmount: string;
  manualAdjustmentReason: string | null;
  notes: string | null;
  modifications: PosOrderItemModification[];
}

export interface PosOrder {
  id: string;
  publicCode: string;
  serviceTabId: string | null;
  source: OrderSource;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  fulfillmentMethod: FulfillmentMethod;
  total: string;
  customerName: string | null;
  customerPhone: string | null;
  assignedUserId: string | null;
  assignment?: OperationalAssignment | null;
  version: number;
  notes?: string | null;
  createdAt: string;
  items: PosOrderItem[];
}

export interface PendingPaymentOrder {
  id: string;
  publicCode: string;
  customerName: string | null;
  status: OrderStatus;
  total: string;
  paidAmount: string;
  openBalance: string;
  createdAt: string;
  assignment?: OperationalAssignment | null;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    notes: string | null;
    modifications: Array<{
      id: string;
      type: ItemModificationType;
      name: string;
      quantity: number;
    }>;
  }>;
}

export interface ServiceTabSummary {
  id: string;
  number: string;
  displayName: string | null;
  publicCode: string;
  status: ServiceTabStatus;
  assignedUserId: string | null;
  assignment?: OperationalAssignment | null;
  grossTotal: string;
  paidAmount: string;
  openBalance: string;
  version: number;
  openedAt: string;
  closedAt: string | null;
}

export interface ServiceTabDetail extends ServiceTabSummary {
  notes: string | null;
  orders: PosOrder[];
  charges: Array<{
    id: string;
    status: string;
    amount: string;
  }>;
}

export interface CreateServiceTabInput {
  number: string;
  displayName?: string;
  notes?: string;
}

export interface UpdateServiceTabInput {
  expectedVersion: number;
  displayName?: string | null;
  notes?: string | null;
}

export interface ServiceTabTransitionInput {
  expectedVersion: number;
  reason?: string;
}

export interface KdsOrder extends AdminOrder {
  source: OrderSource;
  publicCode: string;
  version: number;
  ageSeconds: number;
  overdue: boolean;
  nextStatuses: OrderStatus[];
  paymentInstitution: PaymentInstitution | null;
  paymentMethod: PaymentMethod;
  assignedUserId?: string | null;
  assignment?: OperationalAssignment | null;
  serviceTabId?: string | null;
}

export interface UpdateKdsOrderStatusInput {
  status: OrderStatus;
  expectedVersion: number;
  reason?: string;
}

export interface OperationalAssignee {
  id: string;
  name: string;
  email: string;
}

export interface OperationalAssignment {
  userId: string;
  userName: string;
  assignedAt: string;
}

export interface ClaimOperationalAssignmentInput {
  expectedVersion: number;
}

export interface TransferOperationalAssignmentInput {
  expectedVersion: number;
  assigneeUserId: string;
  reason: string;
}

export type PublicQueueStatus = "PENDING" | "PREPARING" | "READY" | "DELIVERED";

export interface PublicQueueItem {
  publicCode: string;
  displayName: string | null;
  status: PublicQueueStatus;
  enteredAt: string;
}

export interface PublicOrderQueue {
  storeName: string;
  generatedAt: string;
  staleAfterSeconds: number;
  active: PublicQueueItem[];
  completed: PublicQueueItem[];
}
