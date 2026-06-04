export type OrderStatus = "PENDING" | "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELLED";

export type FulfillmentMethod = "DELIVERY" | "PICKUP";

export type PaymentMethod =
  | "CASH"
  | "PIX_MANUAL"
  | "CARD_ON_DELIVERY"
  | "DEBIT_CARD"
  | "CREDIT_CARD"
  | "VOUCHER"
  | "PIX";

export type PaymentInstitution = "PAGBANK" | "MERCADO_PAGO" | "DINHEIRO" | "CAIXA_LOCAL";
export type PaymentReleaseSource = "EXTRACT" | "D_PLUS_30_FALLBACK" | "IMMEDIATE";
export type PaymentReleaseStatus = "RELEASED" | "PENDING_RELEASE";
export type OrderMaintenanceAction = "EDIT" | "DELETE";

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
    branding?: PublicStoreBranding;
  };
  categories: PublicMenuCategory[];
}

export type NeutralTheme = "LIGHT" | "DARK" | "SYSTEM_DEFAULT";

export type VisualConfigurationStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type StoreLayoutPresetKey = "classic" | "compact" | "visual";

export interface LayoutPreset {
  key: StoreLayoutPresetKey;
  name: string;
  description: string;
  active: boolean;
}

export interface PublicStoreBranding {
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  neutralTheme: NeutralTheme;
  layoutPreset: StoreLayoutPresetKey;
}

export interface StoreOwnerInput {
  name: string;
  email: string;
  temporaryPassword: string;
}

export interface CreateStoreInput {
  name: string;
  slug: string;
  phone: string;
  active?: boolean;
  isOpen?: boolean;
  owner: StoreOwnerInput;
}

export interface UpdateStoreInput {
  name?: string;
  slug?: string;
  phone?: string;
  active?: boolean;
  isOpen?: boolean;
}

export interface LaunchReadinessCheck {
  key: string;
  passed: boolean;
  message: string;
}

export interface LaunchReadiness {
  ready: boolean;
  checks: LaunchReadinessCheck[];
}

export interface StoreSummary {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  isOpen: boolean;
  readiness?: LaunchReadiness;
}

export interface StoreResponsibleUser {
  id: string;
  name: string;
  email: string;
}

export interface StoreDetail extends StoreSummary {
  phone: string;
  owner?: StoreResponsibleUser;
  branding?: VisualConfiguration;
}

export interface StoreSetupResult {
  store: StoreDetail;
  owner: StoreResponsibleUser;
}

export interface BrandingDraftInput {
  logoUrl?: string | null;
  primaryColor: string;
  accentColor: string;
  neutralTheme: NeutralTheme;
  layoutPreset: StoreLayoutPresetKey;
}

export interface VisualConfiguration extends PublicStoreBranding {
  id: string;
  status: VisualConfigurationStatus;
  publishedAt: string | null;
}

export interface BrandingState {
  draft?: VisualConfiguration | null;
  published?: VisualConfiguration | null;
  availableLayouts: LayoutPreset[];
}

export interface BrandingPreview {
  safeToPublish: boolean;
  warnings: string[];
  configuration: VisualConfiguration;
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
  paymentInstitution?: PaymentInstitution;
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
  paymentInstitution?: PaymentInstitution | null;
  externalPaymentId?: string | null;
  paymentGrossAmount?: string | null;
  paymentFeeAmount?: string | null;
  paymentNetAmount?: string | null;
  paymentBrand?: string | null;
  paymentReleaseExpectedAt?: string | null;
  paymentReleaseSource?: PaymentReleaseSource | null;
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

export interface AdminOrderStockWarning {
  ingredientId: string;
  ingredientName: string;
  requiredQuantity: number;
  estimatedBalance: number;
  status: "BUY" | "INSUFFICIENT";
}

export interface AdminOrder {
  id: string;
  status: OrderStatus;
  total: string;
  customerName: string;
  customerPhone: string;
  fulfillmentMethod: FulfillmentMethod;
  paymentMethod: PaymentMethod;
  paymentInstitution?: PaymentInstitution | null;
  externalPaymentId?: string | null;
  paymentGrossAmount?: string | null;
  paymentFeeAmount?: string | null;
  paymentNetAmount?: string | null;
  paymentBrand?: string | null;
  paymentReleaseExpectedAt?: string | null;
  paymentReleaseSource?: PaymentReleaseSource | null;
  orderPlatformId?: string | null;
  notes: string | null;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  deletionReason?: string | null;
  items: AdminOrderItem[];
  stockWarnings?: AdminOrderStockWarning[];
}

export interface MaintainableOrderItem {
  id?: string | null;
  productId: string;
  productNameSnapshot: string;
  quantity: number;
  unitPrice: string;
}

export interface EditOrderInput {
  expectedUpdatedAt: string;
  reason?: string;
  customerName: string;
  customerPhone: string;
  fulfillmentMethod: FulfillmentMethod;
  deliveryAddress?: Record<string, unknown> | null;
  notes?: string | null;
  createdAt: string;
  paymentMethod: PaymentMethod;
  paymentInstitution?: PaymentInstitution | null;
  externalPaymentId?: string | null;
  paymentGrossAmount?: string | null;
  paymentFeeAmount?: string | null;
  paymentNetAmount?: string | null;
  paymentBrand?: string | null;
  paymentReleaseExpectedAt?: string | null;
  orderPlatformId?: string | null;
  items: MaintainableOrderItem[];
}

export interface DeleteOrderInput {
  expectedUpdatedAt: string;
  reason: string;
}

export interface OrderMaintenanceRecord {
  id: string;
  action: OrderMaintenanceAction;
  actorUserId: string;
  actorName: string;
  reason: string;
  beforeSnapshot: Record<string, unknown>;
  afterSnapshot: Record<string, unknown> | null;
  impactSummary: Record<string, unknown>;
  createdAt: string;
}

export type HistoricalOrderImportStrategy = "PRICE_WEIGHTED" | "FIXED_PRODUCT";
export type HistoricalOrderImportLayout = "SIMPLE" | "MERCADO_PAGO" | "PAGBANK";

export interface HistoricalOrderImportInput {
  csvText: string;
  layout?: HistoricalOrderImportLayout;
  strategy?: HistoricalOrderImportStrategy;
  fixedProductId?: string;
  orderPlatformName?: string;
  paymentInstitution?: PaymentInstitution;
  paymentMethod?: PaymentMethod;
}

export interface HistoricalOrderImportItem {
  rowNumber: number;
  orderId: string;
  date: string;
  amount: string;
  productId: string;
  productName: string;
  paymentInstitution: PaymentInstitution | null;
  paymentMethod: PaymentMethod;
  externalPaymentId: string | null;
  grossAmount: string;
  feeAmount: string | null;
  netAmount: string | null;
  paymentReleaseExpectedAt: string | null;
  paymentReleaseSource: PaymentReleaseSource | null;
}

export interface HistoricalOrderImportSkippedItem {
  rowNumber: number;
  reason: string;
}

export interface HistoricalOrderImportResult {
  parsedRows: number;
  importedCount: number;
  skippedCount: number;
  imported: HistoricalOrderImportItem[];
  skipped: HistoricalOrderImportSkippedItem[];
}

export interface SalesReportFilters {
  start?: string;
  end?: string;
  paymentInstitution?: PaymentInstitution;
  paymentMethod?: PaymentMethod;
  orderPlatformId?: string;
  status?: OrderStatus;
  page?: number;
  pageSize?: number;
}

export interface SalesReportSummary {
  orderCount: number;
  grossRevenue: string;
  acquiredNetRevenue: string;
  releasedNetRevenue: string;
  receivableNetAmount: string;
  paymentFeeAmount: string;
  averageTicket: string;
  periodStart: string;
  periodEnd: string;
}

export interface DailySalesSummary {
  date: string;
  orderCount: number;
  grossRevenue: string;
  acquiredNetRevenue: string;
  releasedNetRevenue: string;
  receivableNetAmount: string;
  paymentFeeAmount: string;
  averageTicket: string;
  grossRevenueDeltaRate: number | null;
  orderCountDeltaRate: number | null;
}

export interface PaymentDimensionSummary {
  dimensionKey: string;
  dimensionLabel: string;
  orderCount: number;
  grossRevenue: string;
  acquiredNetRevenue: string;
  releasedNetRevenue: string;
  receivableNetAmount: string;
  paymentFeeAmount: string;
  shareOfGrossRevenue: number;
}

export interface ChannelSummary {
  orderPlatformId: string | null;
  orderPlatformName: string;
  orderCount: number;
  grossRevenue: string;
  acquiredNetRevenue: string;
  releasedNetRevenue: string;
  receivableNetAmount: string;
  paymentFeeAmount: string;
  averageTicket: string;
}

export interface SalesAnalyticalProduct {
  quantity: number;
  productName: string;
}

export interface SalesAnalyticalOrder {
  orderId: string;
  createdAt: string;
  status: OrderStatus;
  customerName: string;
  orderPlatformName: string | null;
  paymentInstitution: PaymentInstitution | null;
  paymentMethod: PaymentMethod;
  externalPaymentId: string | null;
  paymentBrand: string | null;
  grossAmount: string;
  paymentFeeAmount: string | null;
  acquiredNetAmount: string;
  paymentReleaseExpectedAt: string | null;
  paymentReleaseStatus: PaymentReleaseStatus;
  itemCount: number;
  assignedProducts: SalesAnalyticalProduct[];
  imported: boolean;
}

export interface SalesAnalyticalPage {
  page: number;
  pageSize: number;
  total: number;
  items: SalesAnalyticalOrder[];
}

export interface ReceivablesSummary {
  pendingOrderCount: number;
  receivableNetAmount: string;
  nextExpectedReleaseDate: string | null;
}

export interface SalesReportResponse {
  filters: Required<Pick<SalesReportFilters, "start" | "end" | "page" | "pageSize">> &
    Omit<SalesReportFilters, "start" | "end" | "page" | "pageSize">;
  summary: SalesReportSummary;
  daily: DailySalesSummary[];
  byPaymentInstitution: PaymentDimensionSummary[];
  byPaymentMethod: PaymentDimensionSummary[];
  byChannel: ChannelSummary[];
  analytical: SalesAnalyticalPage;
  receivables: ReceivablesSummary;
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

export interface FinancialDreSummary {
  periodStart: string;
  periodEnd: string;
  grossRevenue: string;
  discounts: string;
  netRevenue: string;
  acquiredNetRevenue: string;
  cmv: string;
  feesAndTaxes: string;
  grossProfit: string;
  fixedExpenses: string;
  estimatedNetProfit: string;
  netMarginRate: number;
  breakEvenRevenue: string;
}

export interface FinancialDashboardIndicators {
  periodStart: string;
  periodEnd: string;
  grossRevenue: string;
  cmv: string;
  grossProfit: string;
  estimatedNetProfit: string;
  netMarginRate: number;
  deliveredOrderCount: number;
  priceReviewCount: number;
  stockAlertCount: number;
}

export type MenuEngineeringClassification = "STAR" | "WORKHORSE" | "PUZZLE" | "DOG";

export interface MenuEngineeringItem {
  productId: string;
  productName: string;
  volumeSold: number;
  revenue: string;
  cmv: string;
  grossProfit: string;
  marginRate: number;
  classification: MenuEngineeringClassification;
}

export interface MenuEngineeringReport {
  periodStart: string;
  periodEnd: string;
  insufficientData: boolean;
  averageVolume: number;
  averageMarginRate: number;
  items: MenuEngineeringItem[];
}
