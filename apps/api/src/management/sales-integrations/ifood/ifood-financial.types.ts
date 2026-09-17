export interface IfoodSalesPage {
  page: number;
  size: number;
  beginSalesDate: string;
  endSalesDate: string;
  total: number;
  pageCount: number;
  sales: IfoodFinancialSale[];
}

export interface IfoodFinancialSale {
  id: string;
  shortId?: string | number;
  createdAt: string;
  type?: string;
  category?: string;
  salesChannel?: string;
  currentStatus: string;
  merchant: { id: string; timezone: string; [key: string]: unknown };
  saleGrossValue: { bag: number; deliveryFee?: number; serviceFee?: number };
  benefits?: { totalValue?: number; [key: string]: unknown };
  payments: { methods: IfoodPaymentMethod[] };
  billingSummary: { saleBalance: number; [key: string]: unknown };
  orderStatusHistory?: unknown[];
  orderEvents?: unknown[];
  [key: string]: unknown;
}

export interface IfoodPaymentMethod {
  method: string | { method?: string; [key: string]: unknown };
  currency?: string;
  type?: string;
  value?: number;
  liability?: string;
  card?: { brand?: string };
  installment?: {
    maxInstallments?: number;
    installmentDetail?: Array<{
      reference?: string | number;
      sequence?: number;
      amount?: number;
      expectedPaymentDate?: string;
      status?: string;
      settledAt?: string;
    }>;
  };
  transaction?: { nsu?: string; acquirerDocument?: string };
  [key: string]: unknown;
}

export interface IfoodFinancialEvent {
  name: string;
  description?: string;
  product?: string;
  trigger?: string;
  competence?: string;
  reference?: { type?: string; id?: string; date?: string };
  hasTransferImpact: boolean;
  amount: { value: string | number };
  billing?: { baseValue?: string | number; feePercentage?: string | number };
  settlement?: { id?: string; expectedDate?: string };
  [key: string]: unknown;
}

export interface IfoodFinancialEventsPage {
  page: number;
  size: number;
  hasNextPage: boolean;
  totalPages?: number;
  financialEvents: IfoodFinancialEvent[];
}

export interface IfoodSettlementClosingItem {
  id: string;
  type: string;
  status: string;
  amount: string | number;
  expectedPaymentDate?: string;
  paymentDate?: string;
  [key: string]: unknown;
}

export interface IfoodSettlement {
  id: string;
  product?: string;
  status: string;
  calculationPeriod?: { beginDate?: string; endDate?: string };
  closingItems: IfoodSettlementClosingItem[];
  [key: string]: unknown;
}

export interface IfoodSettlementsResponse {
  balance: string | number;
  settlements: IfoodSettlement[];
}

export interface IfoodReconciliationFileResponse {
  requestId: string;
  status?: string;
  competencia?: string;
  competence?: string;
  orderCount?: number;
  lineCount?: number;
  downloadUrl?: string;
  expiresAt?: string;
}

export function parseIfoodFinancialEventsPage(value: unknown): IfoodFinancialEventsPage {
  const record = objectValue(value, "resposta");
  const events = arrayValue(record.financialEvents, "financialEvents").map((value, index) => {
    const event = objectValue(value, `financialEvents[${index}]`);
    const amount = objectValue(event.amount, `financialEvents[${index}].amount`);
    return {
      ...event,
      name: stringValue(event.name, `financialEvents[${index}].name`),
      hasTransferImpact: Boolean(event.hasTransferImpact),
      amount: {
        ...amount,
        value: moneyValue(amount.value, `financialEvents[${index}].amount.value`),
      },
    } as IfoodFinancialEvent;
  });
  return {
    page: integerValue(record.page, "page"),
    size: integerValue(record.size, "size"),
    hasNextPage: record.hasNextPage === true,
    totalPages:
      typeof record.totalPages === "number"
        ? integerValue(record.totalPages, "totalPages")
        : undefined,
    financialEvents: events,
  };
}

export function parseIfoodSettlements(value: unknown): IfoodSettlementsResponse {
  const record = objectValue(value, "resposta");
  return {
    balance: moneyValue(record.balance, "balance"),
    settlements: arrayValue(record.settlements, "settlements").map((value, index) => {
      const settlement = objectValue(value, `settlements[${index}]`);
      return {
        ...settlement,
        id: stringValue(settlement.id, `settlements[${index}].id`),
        status: stringValue(settlement.status, `settlements[${index}].status`),
        closingItems: arrayValue(settlement.closingItems, `settlements[${index}].closingItems`).map(
          (value, itemIndex) => {
            const item = objectValue(value, `settlements[${index}].closingItems[${itemIndex}]`);
            return {
              ...item,
              id: stringValue(item.id, "closingItem.id"),
              type: stringValue(item.type, "closingItem.type"),
              status: stringValue(item.status, "closingItem.status"),
              amount: moneyValue(item.amount, "closingItem.amount"),
            } as IfoodSettlementClosingItem;
          }
        ),
      } as IfoodSettlement;
    }),
  };
}

export function parseIfoodReconciliationFile(value: unknown): IfoodReconciliationFileResponse {
  const record = objectValue(value, "resposta");
  return {
    requestId: stringValue(record.requestId, "requestId"),
    status: typeof record.status === "string" ? record.status : undefined,
    competencia: typeof record.competencia === "string" ? record.competencia : undefined,
    competence: typeof record.competence === "string" ? record.competence : undefined,
    orderCount: typeof record.orderCount === "number" ? record.orderCount : undefined,
    lineCount: typeof record.lineCount === "number" ? record.lineCount : undefined,
    downloadUrl: typeof record.downloadUrl === "string" ? record.downloadUrl : undefined,
    expiresAt: typeof record.expiresAt === "string" ? record.expiresAt : undefined,
  };
}

export function parseIfoodSalesPage(value: unknown): IfoodSalesPage {
  const record = objectValue(value, "resposta");
  const sales = arrayValue(record.sales, "sales").map((sale, index) =>
    parseSale(sale, `sales[${index}]`)
  );
  const page = integerValue(record.page, "page");
  const pageCount = integerValue(record.pageCount, "pageCount");
  const size = integerValue(record.size, "size");
  const total = integerValue(record.total, "total");
  if (page < 0 || pageCount < 0 || size < 0 || total < 0)
    throw new TypeError("Paginacao iFood invalida");
  return {
    page,
    pageCount,
    size,
    total,
    beginSalesDate: stringValue(record.beginSalesDate, "beginSalesDate"),
    endSalesDate: stringValue(record.endSalesDate, "endSalesDate"),
    sales,
  };
}

function parseSale(value: unknown, path: string): IfoodFinancialSale {
  const sale = objectValue(value, path);
  const merchant = objectValue(sale.merchant, `${path}.merchant`);
  const gross = objectValue(sale.saleGrossValue, `${path}.saleGrossValue`);
  const payments = objectValue(sale.payments, `${path}.payments`);
  const billing = objectValue(sale.billingSummary, `${path}.billingSummary`);
  return {
    ...sale,
    id: stringValue(sale.id, `${path}.id`),
    createdAt: stringValue(sale.createdAt, `${path}.createdAt`),
    currentStatus: stringValue(sale.currentStatus, `${path}.currentStatus`),
    merchant: {
      ...merchant,
      id: stringValue(merchant.id, `${path}.merchant.id`),
      timezone: stringValue(merchant.timezone, `${path}.merchant.timezone`),
    },
    saleGrossValue: {
      ...gross,
      bag: numberValue(gross.bag, `${path}.saleGrossValue.bag`),
      deliveryFee: optionalNumber(gross.deliveryFee),
      serviceFee: optionalNumber(gross.serviceFee),
    },
    payments: {
      methods: arrayValue(payments.methods, `${path}.payments.methods`).map((method, index) =>
        parsePayment(method, `${path}.payments.methods[${index}]`)
      ),
    },
    billingSummary: {
      ...billing,
      saleBalance: numberValue(billing.saleBalance, `${path}.billingSummary.saleBalance`),
    },
  } as IfoodFinancialSale;
}

function parsePayment(value: unknown, path: string): IfoodPaymentMethod {
  const payment = objectValue(value, path);
  if (typeof payment.method !== "string" && !isObject(payment.method)) {
    throw new TypeError(`${path}.method invalido`);
  }
  return { ...payment, method: payment.method } as IfoodPaymentMethod;
}

function objectValue(value: unknown, path: string): Record<string, unknown> {
  if (!isObject(value)) throw new TypeError(`${path} deve ser um objeto`);
  return value;
}
function arrayValue(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${path} deve ser uma lista`);
  return value;
}
function stringValue(value: unknown, path: string): string {
  if (typeof value !== "string" || !value) throw new TypeError(`${path} deve ser texto`);
  return value;
}
function numberValue(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError(`${path} deve ser numero`);
  return value;
}
function integerValue(value: unknown, path: string): number {
  const number = numberValue(value, path);
  if (!Number.isInteger(number)) throw new TypeError(`${path} deve ser inteiro`);
  return number;
}
function optionalNumber(value: unknown): number | undefined {
  return value === undefined || value === null ? undefined : numberValue(value, "valor opcional");
}
function moneyValue(value: unknown, path: string): string | number {
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new TypeError(`${path} deve ser valor monetario`);
}
function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
