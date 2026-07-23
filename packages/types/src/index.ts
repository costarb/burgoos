export type OrderStatus = "PENDING" | "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELLED";

export * from "./delivery-integrations";
export * from "./exports";
export * from "./notifications";

export type AccessUserStatus = "INVITED" | "ACTIVE" | "INACTIVE" | "LOCKED";
export type AccessProfileStatus = "ACTIVE" | "INACTIVE";
export type AccessProfileScope = "GLOBAL" | "STORE";
export type AccessPermissionAction = "VIEW" | "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "MANAGE";
export type AccessAuditResult = "SUCCESS" | "DENIED" | "FAILED";
export type SessionTokenStatus = "ACTIVE" | "REVOKED" | "EXPIRED";
export type PasswordResetPurpose = "FIRST_ACCESS" | "PASSWORD_RESET";
export type PasswordResetTokenStatus = "ACTIVE" | "USED" | "EXPIRED";

export interface AccessStoreSummary {
  id: string;
  name: string;
  slug: string;
  active: boolean;
}

export interface AccessPermission {
  key: string;
  area: string;
  screen: string;
  action: AccessPermissionAction;
  description: string;
  sensitive: boolean;
}

export interface AccessPermissionScreenGroup {
  screen: string;
  permissions: AccessPermission[];
}

export interface AccessPermissionGroup {
  area: string;
  screens: AccessPermissionScreenGroup[];
}

export interface AccessProfileSummary {
  id: string;
  name: string;
  scope: AccessProfileScope;
  storeId: string | null;
  status: AccessProfileStatus;
}

export interface AccessProfileDetail extends AccessProfileSummary {
  description: string | null;
  permissions: AccessPermission[];
}

export interface UserStoreAssignmentSummary {
  store: AccessStoreSummary;
  profile: AccessProfileSummary;
  canManageStoreAccess: boolean;
  status: AccessProfileStatus;
}

export interface AccessUserSummary {
  id: string;
  login: string;
  name: string;
  email: string;
  status: AccessUserStatus;
  isMaster: boolean;
  isPlatformAdmin?: boolean;
  platformRole?: PlatformUserRole;
}

export interface AccessUserDetail extends AccessUserSummary {
  phone: string | null;
  lastLoginAt: string | null;
  assignments: UserStoreAssignmentSummary[];
}

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  user: AccessUserSummary;
  activeStoreId: string | null;
  allowedStores: AccessStoreSummary[];
  permissions: string[];
  accessTokenExpiresAt: string;
}

export interface AccessAuditEvent {
  id: string;
  actorUserId: string | null;
  targetUserId: string | null;
  storeId: string | null;
  eventType: string;
  result: AccessAuditResult;
  reason: string | null;
  occurredAt: string;
}

export type FulfillmentMethod = "DELIVERY" | "PICKUP";

export type PaymentMethod =
  | "CASH"
  | "PIX_MANUAL"
  | "CARD_ON_DELIVERY"
  | "DEBIT_CARD"
  | "CREDIT_CARD"
  | "VOUCHER"
  | "PIX"
  | "DIGITAL_WALLET";

export * from "./sales-integrations";

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
    phone?: string | null;
    isOpen: boolean;
    address?: StoreAddress | null;
    socialLinks?: StoreSocialLinks | null;
    branding?: PublicStoreBranding;
  };
  categories: PublicMenuCategory[];
}

export type NeutralTheme = "LIGHT" | "DARK" | "SYSTEM_DEFAULT";

export type VisualConfigurationStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type StoreLayoutPresetKey = "classic" | "compact" | "visual";
export type StoreOpenMode = "SCHEDULE" | "FORCE_OPEN" | "FORCE_CLOSED";

export interface LayoutPreset {
  key: StoreLayoutPresetKey;
  name: string;
  description: string;
  active: boolean;
}

export interface PublicStoreBranding {
  logoUrl: string | null;
  headerImageUrl: string | null;
  bodyImageUrl: string | null;
  footerImageUrl: string | null;
  primaryColor: string;
  accentColor: string;
  neutralTheme: NeutralTheme;
  layoutPreset: StoreLayoutPresetKey;
  showProductImages: boolean;
  showProductDescriptions: boolean;
  orderingEnabled: boolean;
}

export interface StoreOwnerInput {
  name: string;
  email: string;
  temporaryPassword: string;
}

export interface StoreAddress {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

export interface StoreSocialLinks {
  instagram?: string;
  facebook?: string;
  whatsapp?: string;
  website?: string;
}

export interface CreateStoreInput {
  name: string;
  slug: string;
  publicDomain?: string;
  phone: string;
  address?: StoreAddress;
  socialLinks?: StoreSocialLinks;
  active?: boolean;
  isOpen?: boolean;
  openMode?: StoreOpenMode;
  operatingHours?: Record<string, unknown>;
  owner: StoreOwnerInput;
}

export interface UpdateStoreInput {
  name?: string;
  slug?: string;
  publicDomain?: string | null;
  phone?: string;
  address?: StoreAddress;
  socialLinks?: StoreSocialLinks;
  active?: boolean;
  isOpen?: boolean;
  openMode?: StoreOpenMode;
  operatingHours?: Record<string, unknown>;
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
  publicDomain?: string | null;
  publicMenuUrl?: string | null;
  phone?: string;
  city?: string | null;
  state?: string | null;
  active: boolean;
  isOpen: boolean;
  openMode: StoreOpenMode;
  readiness?: LaunchReadiness;
}

export interface StoreResponsibleUser {
  id: string;
  name: string;
  email: string;
}

export interface StoreDetail extends StoreSummary {
  phone: string;
  address?: StoreAddress | null;
  socialLinks?: StoreSocialLinks | null;
  operatingHours: Record<string, unknown>;
  owner?: StoreResponsibleUser;
  branding?: VisualConfiguration;
}

export interface StoreSetupResult {
  store: StoreDetail;
  owner: StoreResponsibleUser;
}

export type PlatformUserRole = "SUPER_ADMIN" | "SUPPORT";

export interface PlatformUserSummary {
  id: string;
  name: string;
  email: string;
  role: PlatformUserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlatformUserInput {
  name: string;
  email: string;
  role: PlatformUserRole;
  active?: boolean;
  temporaryPassword: string;
}

export interface UpdatePlatformUserInput {
  name?: string;
  email?: string;
  role?: PlatformUserRole;
  active?: boolean;
  temporaryPassword?: string;
}

export interface BrandingDraftInput {
  logoUrl?: string | null;
  headerImageUrl?: string | null;
  bodyImageUrl?: string | null;
  footerImageUrl?: string | null;
  primaryColor: string;
  accentColor: string;
  neutralTheme: NeutralTheme;
  layoutPreset: StoreLayoutPresetKey;
  showProductImages?: boolean;
  showProductDescriptions?: boolean;
  orderingEnabled?: boolean;
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

export interface PlatformSyncAttemptSummary {
  id: string;
  action: NonNullable<AdminOrder["platformSyncAction"]>;
  status: NonNullable<AdminOrder["platformSyncStatus"]>;
  errorCode: string | null;
  errorMessage: string | null;
  nextRetryAt: string | null;
  sentAt: string | null;
  confirmedAt: string | null;
  createdAt: string;
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
  platformProvider?: "IFOOD" | "CUSTOM" | null;
  externalOrderId?: string | null;
  externalMerchantId?: string | null;
  platformExternalStatus?: string | null;
  platformConfirmationDeadlineAt?: string | null;
  platformConfirmationState?: "OK" | "DUE_SOON" | "EXPIRED" | null;
  platformSyncStatus?:
    | "PENDING"
    | "SENT"
    | "CONFIRMED"
    | "FAILED"
    | "RETRYABLE"
    | "CANCELLED"
    | null;
  platformSyncAction?:
    | "CONFIRM"
    | "REFUSE"
    | "START_PREPARATION"
    | "READY_TO_PICKUP"
    | "DISPATCH"
    | "DELIVER"
    | "REQUEST_CANCELLATION"
    | "RESPOND_DISPUTE"
    | null;
  platformSyncError?: string | null;
  platformSyncNextRetryAt?: string | null;
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
  paymentInstitutionId?: string;
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
  paymentInstitutionId: string | null;
  paymentInstitutionName: string | null;
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
  id: string;
  productId: string;
  quantity: number;
  productName: string;
  unitPrice: string;
  total: string;
}

export interface SalesAnalyticalOrder {
  orderId: string;
  createdAt: string;
  updatedAt: string;
  status: OrderStatus;
  total: string;
  customerName: string;
  customerPhone: string;
  fulfillmentMethod: FulfillmentMethod;
  notes: string | null;
  orderPlatformId: string | null;
  orderPlatformName: string | null;
  paymentInstitution: PaymentInstitution | null;
  paymentMethod: PaymentMethod;
  externalPaymentId: string | null;
  paymentBrand: string | null;
  grossAmount: string;
  paymentFeeAmount: string | null;
  acquiredNetAmount: string;
  paymentReleaseExpectedAt: string | null;
  paymentReleaseSource: PaymentReleaseSource | null;
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

export interface ManagementReportFilters {
  start?: string;
  end?: string;
}

export interface ManagementReportPeriod {
  start: string;
  end: string;
}

export interface ManagementExecutiveSummary {
  grossRevenue: string;
  netRevenue: string;
  cashNet: string;
  finalBalance: string;
  payablesOpen: string;
  payablesOverdue: string;
  receivableAmount: string;
  periodNarrative: string;
}

export interface ManagementAccountBalanceSummary {
  accountId: string | null;
  accountName: string;
  balance: string;
}

export interface ManagementCashFlowSection {
  credits: string;
  debits: string;
  net: string;
  finalBalance: string;
  balancesByAccount: ManagementAccountBalanceSummary[];
}

export interface ManagementSalesTrendPoint {
  date: string;
  orders: number;
  grossRevenue: string;
  netRevenue: string;
}

export interface ManagementSalesDimensionSummary {
  key: string | null;
  label: string;
  orders: number;
  grossRevenue: string;
  netRevenue: string;
  shareOfGrossRevenue: number;
}

export interface ManagementSalesSection {
  orders: number;
  grossRevenue: string;
  netRevenue: string;
  releasedAmount: string;
  receivableAmount: string;
  feeAmount: string;
  averageTicket: string;
  daily: ManagementSalesTrendPoint[];
  byInstitution: ManagementSalesDimensionSummary[];
  byPaymentMethod: ManagementSalesDimensionSummary[];
  byChannel: ManagementSalesDimensionSummary[];
}

export interface ManagementExpenseCategorySummary {
  categoryId: string | null;
  categoryName: string;
  expected: string;
  paid: string;
  open: string;
  overdue: string;
  shareOfExpected: number;
}

export interface ManagementPayablesSection {
  expected: string;
  paid: string;
  open: string;
  overdue: string;
  openCount: number;
  overdueCount: number;
  byCategory: ManagementExpenseCategorySummary[];
}

export interface ManagementReportResponse {
  period: ManagementReportPeriod;
  executiveSummary: ManagementExecutiveSummary;
  cashFlow: ManagementCashFlowSection;
  sales: ManagementSalesSection;
  payables: ManagementPayablesSection;
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

export type OperationStatus = "idle" | "pending" | "success" | "error";

export interface OperationProgress {
  current: number;
  total: number;
  label?: string;
}

export interface OperationResultCounts {
  processed?: number;
  completed?: number;
  skipped?: number;
  failed?: number;
}

export interface OperationState {
  status: OperationStatus;
  message?: string;
  progress?: OperationProgress;
  result?: OperationResultCounts;
}

export type FinancialRecurrenceFrequency = "WEEKLY" | "MONTHLY" | "YEARLY";

export type PayableStatus = "OPEN" | "OVERDUE" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";

export interface FinancialAccount {
  id: string;
  name: string;
  paymentInstitution: PaymentInstitution | null;
  paymentInstitutionId: string | null;
  paymentInstitutionName: string | null;
  openingBalance: string;
  openingBalanceAt: string;
  active: boolean;
}

export interface PaymentInstitutionConfiguration {
  id: string;
  name: string;
  code: string;
  paymentInstitution: PaymentInstitution | null;
  active: boolean;
}

export interface FinancialCategory {
  id: string;
  name: string;
  active: boolean;
}

export interface FinancialAccountInput {
  name: string;
  paymentInstitution?: PaymentInstitution | null;
  paymentInstitutionId?: string | null;
  openingBalance: number;
  openingBalanceAt: string;
  active?: boolean;
}

export interface PaymentInstitutionConfigurationInput {
  name: string;
  code?: string;
  paymentInstitution?: PaymentInstitution | null;
  active?: boolean;
}

export interface PaymentInstitutionFilters {
  search?: string;
  active?: string;
}

export interface FinancialCategoryInput {
  name: string;
  active?: boolean;
}

export interface PayablePayment {
  id: string;
  payableId: string;
  financialAccountId: string;
  financialAccountName: string;
  amount: string;
  paidAt: string;
  notes: string | null;
  reversedAt: string | null;
  reversalReason: string | null;
}

export interface Payable {
  id: string;
  categoryId: string;
  categoryName: string;
  supplierId: string | null;
  supplierName: string | null;
  recurrenceGroupId: string | null;
  description: string;
  documentReference: string | null;
  competenceDate: string | null;
  dueDate: string;
  expectedAmount: string;
  paidAmount: string;
  remainingAmount: string;
  status: PayableStatus;
  notes: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  payments: PayablePayment[];
}

export interface PayablesSummary {
  totalExpected: string;
  totalPaid: string;
  totalRemaining: string;
  overdueAmount: string;
  openCount: number;
  overdueCount: number;
}

export interface PayablesResponse {
  items: Payable[];
  summary: PayablesSummary;
}

export interface PayablesFilters {
  start?: string;
  end?: string;
  status?: PayableStatus | string;
  categoryId?: string;
  supplierId?: string;
  competenceMonth?: string;
}

export interface PayableOptions {
  categories: FinancialCategory[];
  accounts: FinancialAccount[];
  suppliers: Pick<Supplier, "id" | "name" | "active">[];
}

export type FinancialAuditAction = "CREATE" | "UPDATE" | "CANCEL" | "PAY" | "REVERSE" | "ADJUST";

export interface FinancialAuditRecord {
  id: string;
  entityType: string;
  entityId: string;
  action: FinancialAuditAction;
  actorName: string;
  actorEmail: string;
  createdAt: string;
}

export type CashMovementType = "MANUAL_INFLOW" | "MANUAL_OUTFLOW" | "TRANSFER" | "ADJUSTMENT";

export type CashLedgerSourceType =
  | "OPENING_BALANCE"
  | "ORDER_RECEIPT"
  | "PAYABLE_PAYMENT"
  | "CASH_MOVEMENT";

export type CashRealizationStatus = "REALIZED" | "PROJECTED";

export interface CashMovement {
  id: string;
  type: CashMovementType;
  financialAccountId: string;
  financialAccountName: string;
  destinationAccountId: string | null;
  destinationAccountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  amount: string;
  occurredAt: string;
  description: string;
  justification: string | null;
  reversedAt: string | null;
  reversalReason: string | null;
}

export interface CashMovementInput {
  type: CashMovementType;
  financialAccountId: string;
  destinationAccountId?: string | null;
  categoryId?: string | null;
  amount: number;
  occurredAt: string;
  description: string;
  justification?: string;
}

export interface CashAccountBalance {
  financialAccountId: string | null;
  financialAccountName: string;
  balance: string;
  unallocated: boolean;
}

export interface CashLedgerEntry {
  sourceType: CashLedgerSourceType;
  sourceId: string;
  financialAccountId: string | null;
  financialAccountName: string;
  occurredAt: string;
  description: string;
  inflowAmount: string;
  outflowAmount: string;
  runningBalance: string;
  realizationStatus: CashRealizationStatus;
}

export interface CashStatementEntry extends CashLedgerEntry {
  entryType: "CREDIT" | "DEBIT";
  amount: string;
}

export interface CashStatementDay {
  date: string;
  creditAmount: string;
  debitAmount: string;
  netAmount: string;
  runningBalance: string;
  entries: CashStatementEntry[];
}

export interface CashStatement {
  start: string;
  end: string;
  financialAccountId: string | null;
  openingBalance: string;
  closingBalance: string;
  totalCredit: string;
  totalDebit: string;
  netAmount: string;
  days: CashStatementDay[];
}

export interface CashProjectionEntry {
  sourceType: "ORDER_RECEIPT" | "PAYABLE";
  sourceId: string;
  financialAccountId: string | null;
  financialAccountName: string;
  occurredAt: string;
  description: string;
  inflowAmount: string;
  outflowAmount: string;
  projectedBalance: string;
}

export interface CashTimelineDay {
  date: string;
  inflowAmount: string;
  outflowAmount: string;
  netAmount: string;
}

export interface CashPosition {
  asOf: string;
  projectionEnd: string;
  currentBalance: string;
  receivableAmount: string;
  payableAmount: string;
  projectedBalance: string;
  negativeBalanceDetected: boolean;
  accounts: CashAccountBalance[];
  ledger: CashLedgerEntry[];
  projection: CashProjectionEntry[];
  timeline: CashTimelineDay[];
}

export interface PayableRecurrenceInput {
  frequency: FinancialRecurrenceFrequency;
  interval: number;
  startsOn: string;
  endsOn?: string;
  occurrenceCount?: number;
}

export interface PayableInput {
  categoryId: string;
  supplierId?: string | null;
  description: string;
  documentReference?: string;
  competenceDate?: string;
  dueDate: string;
  expectedAmount: number;
  notes?: string;
  recurrence?: PayableRecurrenceInput | null;
}

export interface PayablePaymentInput {
  financialAccountId: string;
  amount: number;
  paidAt: string;
  notes?: string;
}
