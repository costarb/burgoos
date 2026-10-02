import { INestApplication } from "@nestjs/common";
import { McpDataArea } from "@prisma/client";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { vi } from "vitest";
import { MemoryPressureService } from "../../src/common/observability/memory-pressure.service";
import { AccessAuditService } from "../../src/management/access/access-audit.service";
import { AccountsPayableService } from "../../src/management/financial/accounts-payable/accounts-payable.service";
import { CashFlowService } from "../../src/management/financial/cash-flow/cash-flow.service";
import { hashMcpToken } from "../../src/management/mcp/admin/mcp-token.util";
import { MCP_SERVER_PROVIDERS } from "../../src/management/mcp/mcp.module";
import { McpController } from "../../src/management/mcp/server/mcp.controller";
import { ReportsService } from "../../src/management/reports.service";
import { DreService } from "../../src/management/reports/dre.service";
import { FinancialDashboardService } from "../../src/management/reports/financial-dashboard.service";
import { ManagementReportService } from "../../src/management/reports/management-report.service";
import { MenuEngineeringService } from "../../src/management/reports/menu-engineering.service";
import { SalesReportService } from "../../src/management/reports/sales-report.service";
import { InventoryService } from "../../src/operations/inventory/inventory.service";
import type { McpFakePrisma } from "./mcp-fake-prisma";
import { createMcpTestApp } from "./mcp-test-app";

export const STORE_A = "11111111-1111-4111-8111-111111111111";
export const STORE_B = "22222222-2222-4222-8222-222222222222";

/** Distinct, recognizable data per store so isolation tests can detect leaks. */
export const STORE_DATA = {
  [STORE_A]: {
    name: "Loja Centro",
    slug: "loja-centro",
    product: "Pizza Margherita Centro",
    platform: "iFood Centro",
    supplier: "Fornecedor Centro",
    ingredient: "Mussarela Centro",
    account: "Caixa Centro",
    category: "Aluguel Centro",
    gross: "1500.50",
    orders: 30,
  },
  [STORE_B]: {
    name: "Loja Sul",
    slug: "loja-sul",
    product: "Hamburguer Sul",
    platform: "Rappi Sul",
    supplier: "Fornecedor Sul",
    ingredient: "Pao Sul",
    account: "Caixa Sul",
    category: "Energia Sul",
    gross: "999.90",
    orders: 12,
  },
} as const;

/** Personal data planted in service outputs; it must never reach an MCP response. */
export const PLANTED_PII = {
  customerName: "Maria Cliente Silva",
  customerPhone: "+55 11 98888-7777",
  deliveryAddress: "Rua das Flores, 123",
  document: "123.456.789-00",
  email: "maria.cliente@example.com",
};

type StoreId = keyof typeof STORE_DATA;
const data = (tenantId: string) => STORE_DATA[tenantId as StoreId] ?? STORE_DATA[STORE_A];

export function createServiceMocks() {
  const sales = {
    getReport: vi.fn(async (tenantId: string, query: { start: string; end: string }) => {
      const store = data(tenantId);
      return {
        filters: { start: query.start, end: query.end },
        summary: {
          orderCount: store.orders,
          grossRevenue: store.gross,
          acquiredNetRevenue: "1400.00",
          releasedNetRevenue: "1200.00",
          receivableNetAmount: "200.00",
          paymentFeeAmount: "100.50",
          averageTicket: "50.02",
          periodStart: query.start,
          periodEnd: query.end,
        },
        daily: [
          {
            date: query.start,
            orderCount: store.orders,
            grossRevenue: store.gross,
            acquiredNetRevenue: "1400.00",
            releasedNetRevenue: "1200.00",
            receivableNetAmount: "200.00",
            paymentFeeAmount: "100.50",
            averageTicket: "50.02",
            grossRevenueDeltaRate: null,
          },
        ],
        byPaymentInstitution: [
          {
            dimensionKey: "IFOOD",
            dimensionLabel: "iFood",
            orderCount: store.orders,
            grossRevenue: store.gross,
            acquiredNetRevenue: "1400.00",
            releasedNetRevenue: "1200.00",
            receivableNetAmount: "200.00",
            paymentFeeAmount: "100.50",
            averageTicket: "50.02",
            shareOfGrossRevenue: 1,
          },
        ],
        byPaymentMethod: [
          {
            dimensionKey: "PIX",
            dimensionLabel: "Pix",
            orderCount: store.orders,
            grossRevenue: store.gross,
            acquiredNetRevenue: "1400.00",
            releasedNetRevenue: "1200.00",
            receivableNetAmount: "200.00",
            paymentFeeAmount: "100.50",
            averageTicket: "50.02",
            shareOfGrossRevenue: 1,
          },
        ],
        byChannel: [
          {
            orderPlatformId: "platform-1",
            orderPlatformName: store.platform,
            orderCount: store.orders,
            grossRevenue: store.gross,
            acquiredNetRevenue: "1400.00",
            releasedNetRevenue: "1200.00",
            receivableNetAmount: "200.00",
            paymentFeeAmount: "100.50",
            averageTicket: "50.02",
          },
        ],
        analytical: {
          page: 1,
          pageSize: 1,
          total: store.orders,
          items: [{ id: "order-1", ...PLANTED_PII, total: "50.00" }],
        },
        receivables: {
          pendingOrderCount: 3,
          receivableNetAmount: "200.00",
          nextExpectedReleaseDate: "2026-10-05",
        },
        ifoodFinancial: {
          saleCount: 5,
          bagAmount: "250.00",
          customerPaidAmount: "260.00",
          saleBalanceAmount: "10.00",
          ifoodReceivableAmount: "200.00",
          storeReceivedAmount: "180.00",
        },
      };
    }),
  };

  const reports = {
    getDailySummary: vi.fn(async (tenantId: string, date: string) => ({
      date,
      orderCount: data(tenantId).orders,
      grossRevenue: data(tenantId).gross,
    })),
  };

  const management = {
    getReport: vi.fn(async (tenantId: string, query: { start: string; end: string }) => {
      const store = data(tenantId);
      return {
        period: { start: query.start, end: query.end },
        executiveSummary: {
          grossRevenue: store.gross,
          netRevenue: "1400.00",
          cashNet: "300.00",
          finalBalance: "5000.00",
          payablesOpen: "800.00",
          payablesOverdue: "150.00",
          receivableAmount: "200.00",
          periodNarrative: `Narrativa ${store.name}`,
        },
        cashFlow: {
          credits: "1400.00",
          debits: "1100.00",
          net: "300.00",
          finalBalance: "5000.00",
          balancesByAccount: [{ accountId: "acc-1", accountName: store.account, balance: "5000.00" }],
        },
        sales: {
          orders: store.orders,
          grossRevenue: store.gross,
          netRevenue: "1400.00",
          releasedAmount: "1200.00",
          receivableAmount: "200.00",
          feeAmount: "100.50",
          averageTicket: "50.02",
          daily: [],
          byInstitution: [],
          byPaymentMethod: [],
          byChannel: [],
        },
        payables: {
          expected: "1000.00",
          paid: "200.00",
          open: "800.00",
          overdue: "150.00",
          openCount: 4,
          overdueCount: 1,
          byCategory: [
            {
              categoryId: "cat-1",
              categoryName: store.category,
              expected: "1000.00",
              paid: "200.00",
              open: "800.00",
              overdue: "150.00",
              shareOfExpected: 1,
            },
          ],
        },
      };
    }),
  };

  const dre = {
    getMonthlySummary: vi.fn(async (tenantId: string, competence?: string) => ({
      competence: competence ?? "2026-10",
      periodStart: `${competence ?? "2026-10"}-01`,
      periodEnd: competence === "2026-09" ? "2026-09-30" : `${competence ?? "2026-10"}-31`,
      grossRevenue: data(tenantId).gross,
      discounts: "50.00",
      netRevenue: "1450.50",
      acquiredNetRevenue: "1400.00",
      cmv: "435.15",
      feesAndTaxes: "145.05",
      salesFees: "58.02",
      taxes: "87.03",
      taxRate: 0.06,
      realSalesFees: "50.00",
      estimatedSalesFees: "8.02",
      realFeeOrderCount: 25,
      estimatedFeeOrderCount: 5,
      grossProfit: "870.30",
      contributionMarginRate: 0.6,
      variableExpenses: "0.00",
      fixedExpenses: "500.00",
      estimatedNetProfit: "370.30",
      netMarginRate: 0.2553,
      breakEvenRevenue: "833.33" as string | null,
      plannedFixedCost: "600.00",
      fixedCostVariance: "-100.00",
      expensesByCategory: [
        {
          categoryId: "category-rent",
          categoryName: "Aluguel",
          dreClass: "FIXED_COST" as const,
          amount: "500.00",
          count: 1,
        },
      ],
    })),
  };

  const dashboard = {
    getIndicators: vi.fn(async (tenantId: string) => ({
      periodStart: "2026-10-01T00:00:00.000Z",
      periodEnd: "2026-10-31T23:59:59.999Z",
      competence: "2026-10",
      grossRevenue: data(tenantId).gross,
      netRevenue: "1450.50",
      cmv: "435.15",
      salesFees: "58.02",
      taxes: "87.03",
      grossProfit: "870.30",
      contributionMarginRate: 0.6,
      variableExpenses: "0.00",
      fixedExpenses: "500.00",
      plannedFixedCost: "600.00",
      estimatedNetProfit: "370.30",
      netMarginRate: 0.2553,
      deliveredOrderCount: data(tenantId).orders,
      priceReviewCount: 2,
      stockAlertCount: 1,
    })),
  };

  const menu = {
    getReport: vi.fn(async (tenantId: string, periodStart: Date, periodEnd: Date) => ({
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      insufficientData: false,
      averageVolume: 10.25,
      averageMarginRate: 0.4512,
      items: [
        {
          productId: "product-1",
          productName: data(tenantId).product,
          volumeSold: 20,
          revenue: "800.00",
          cmv: "240.00",
          grossProfit: "560.00",
          marginRate: 0.7,
          classification: "STAR",
        },
        {
          productId: "product-2",
          productName: `Refrigerante ${data(tenantId).name}`,
          volumeSold: 2,
          revenue: "20.00",
          cmv: "15.00",
          grossProfit: "5.00",
          marginRate: 0.25,
          classification: "DOG",
        },
      ],
    })),
  };

  const cashFlow = {
    getPosition: vi.fn(async (tenantId: string, asOf: Date, projectionEnd: Date) => ({
      asOf: asOf.toISOString().slice(0, 10),
      projectionEnd: projectionEnd.toISOString().slice(0, 10),
      currentBalance: "5000.00",
      receivableAmount: "1200.00",
      payableAmount: "6500.00",
      projectedBalance: "-300.00",
      negativeBalanceDetected: true,
      accounts: [
        {
          financialAccountId: "acc-1",
          financialAccountName: data(tenantId).account,
          balance: "5000.00",
          unallocated: false,
        },
      ],
      ledger: [{ description: `${PLANTED_PII.customerName} pedido`, runningBalance: "5000.00" }],
      projection: [
        {
          sourceType: "PAYABLE",
          sourceId: "payable-1",
          financialAccountId: null,
          financialAccountName: "A definir",
          occurredAt: "2026-10-10",
          description: `Aluguel - ${data(tenantId).supplier}`,
          inflowAmount: "0.00",
          outflowAmount: "6500.00",
          projectedBalance: "-1500.00",
        },
      ],
      timeline: [
        { date: "2026-10-10", inflowAmount: "0.00", outflowAmount: "6500.00", netAmount: "-6500.00" },
      ],
    })),
    getStatement: vi.fn(async (tenantId: string, start: Date, end: Date) => ({
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      financialAccountId: null,
      financialAccountIds: [],
      openingBalance: "4700.00",
      closingBalance: "5000.00",
      totalCredit: "1400.00",
      totalDebit: "1100.00",
      netAmount: "300.00",
      days: [
        {
          date: "2026-09-15",
          creditAmount: "1400.00",
          debitAmount: "1100.00",
          netAmount: "300.00",
          runningBalance: "5000.00",
          entries: [
            {
              sourceType: "ORDER_RECEIPT",
              inflowAmount: "1400.00",
              outflowAmount: "0.00",
              description: `Pedido de ${PLANTED_PII.customerName}`,
            },
            {
              sourceType: "PAYABLE_PAYMENT",
              inflowAmount: "0.00",
              outflowAmount: "1100.00",
              description: `Pagamento ${data(tenantId).supplier}`,
            },
          ],
        },
      ],
    })),
  };

  const payables = {
    list: vi.fn(async (tenantId: string) => ({
      items: [
        {
          id: "payable-1",
          categoryId: "cat-1",
          categoryName: data(tenantId).category,
          supplierId: "supplier-1",
          supplierName: data(tenantId).supplier,
          recurrenceGroupId: null,
          description: "Aluguel do mes",
          documentReference: "NF 123 CNPJ 12.345.678/0001-90",
          competenceDate: "2026-10-01",
          dreClassOverride: null,
          categoryDreClass: "FIXED_COST" as const,
          effectiveDreClass: "FIXED_COST" as const,
          dueDate: "2026-10-10",
          expectedAmount: "1000.00",
          paidAmount: "200.00",
          remainingAmount: "800.00",
          status: "PARTIALLY_PAID",
          notes: "Agencia 0001 conta 12345-6",
          cancelledAt: null,
          cancellationReason: null,
          payments: [],
        },
      ],
      summary: {
        totalExpected: "1000.00",
        totalPaid: "200.00",
        totalRemaining: "800.00",
        overdueAmount: "150.00",
        openCount: 4,
        overdueCount: 1,
      },
      page: 1,
      pageSize: 50,
      total: 1,
    })),
    getOptions: vi.fn(async (tenantId: string) => ({
      categories: [{ id: "cat-1", name: data(tenantId).category, active: true }],
      accounts: [],
      suppliers: [{ id: "supplier-1", name: data(tenantId).supplier, active: true }],
    })),
    summarizeByCategory: vi.fn(async (tenantId: string) => [
      {
        categoryId: "cat-1",
        categoryName: data(tenantId).category,
        expected: "1000.00",
        paid: "200.00",
        open: "800.00",
        overdue: "150.00",
      },
    ]),
  };

  const inventory = {
    listBalances: vi.fn(async (tenantId: string) => [
      {
        ingredientId: "ing-1",
        ingredientName: data(tenantId).ingredient,
        currentStock: 1,
        reservedOrConsumed: 2,
        manualEntries: 0,
        estimatedBalance: -1,
        minimumStock: 5,
        status: "INSUFFICIENT",
      },
      {
        ingredientId: "ing-2",
        ingredientName: "Oregano",
        currentStock: 10,
        reservedOrConsumed: 0,
        manualEntries: 0,
        estimatedBalance: 10,
        minimumStock: 1,
        status: "OK",
      },
    ]),
  };

  return { sales, reports, management, dre, dashboard, menu, cashFlow, payables, inventory };
}

export type ServiceMocks = ReturnType<typeof createServiceMocks>;

export const memoryPressureMock = { canAdmit: vi.fn(() => true), level: "NORMAL" };

export async function createMcpServerApp(
  prisma: McpFakePrisma,
  services: ServiceMocks,
  env: Record<string, string> = {}
): Promise<INestApplication> {
  return createMcpTestApp({
    prisma,
    controllers: [McpController],
    env,
    providers: [
      ...MCP_SERVER_PROVIDERS,
      AccessAuditService,
      { provide: MemoryPressureService, useValue: memoryPressureMock },
      { provide: SalesReportService, useValue: services.sales },
      { provide: ReportsService, useValue: services.reports },
      { provide: ManagementReportService, useValue: services.management },
      { provide: DreService, useValue: services.dre },
      { provide: FinancialDashboardService, useValue: services.dashboard },
      { provide: MenuEngineeringService, useValue: services.menu },
      { provide: CashFlowService, useValue: services.cashFlow },
      { provide: AccountsPayableService, useValue: services.payables },
      { provide: InventoryService, useValue: services.inventory },
    ],
  });
}

export function seedStore(
  prisma: McpFakePrisma,
  tenantId: StoreId,
  options: { enabled?: boolean; areas?: McpDataArea[]; active?: boolean } = {}
) {
  const store = STORE_DATA[tenantId];
  prisma.state.tenants.push({
    id: tenantId,
    name: store.name,
    slug: store.slug,
    active: options.active ?? true,
    deactivatedAt: null,
  });
  prisma.state.configurations.push({
    id: `config-${tenantId}`,
    tenantId,
    enabled: options.enabled ?? true,
    enabledAreas: options.areas ?? Object.values(McpDataArea),
    updatedByUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

let tokenCounter = 0;

export function seedToken(
  prisma: McpFakePrisma,
  tenantId: string,
  overrides: Partial<{ revokedAt: Date | null; expiresAt: Date | null }> = {}
): { id: string; token: string } {
  tokenCounter += 1;
  const token = `rrf_mcp_${String(tokenCounter).padStart(43, "x")}`;
  const id = `00000000-0000-4000-8000-${String(tokenCounter).padStart(12, "0")}`;
  prisma.state.tokens.push({
    id,
    tenantId,
    name: `Token ${tokenCounter}`,
    tokenHash: hashMcpToken(token),
    tokenPrefix: token.slice(0, 14),
    expiresAt: null,
    revokedAt: null,
    revokedByUserId: null,
    lastUsedAt: null,
    createdByUserId: null,
    createdAt: new Date(),
    ...overrides,
  });
  return { id, token };
}

export async function listen(app: INestApplication): Promise<string> {
  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address() as { port: number };
  return `http://127.0.0.1:${address.port}/api/mcp`;
}

export async function connectClient(url: string, token: string): Promise<Client> {
  const client = new Client({ name: "rrfive-test", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  await client.connect(transport);
  return client;
}

export const ALL_TOOL_CALLS: Array<{ name: string; arguments: Record<string, unknown> }> = [
  { name: "resumo_vendas", arguments: { inicio: "2026-09-01", fim: "2026-09-30" } },
  { name: "resumo_diario", arguments: { data: "2026-09-15" } },
  { name: "relatorio_gerencial", arguments: { inicio: "2026-09-01", fim: "2026-09-30" } },
  { name: "dre", arguments: { inicio: "2026-09-01", fim: "2026-09-30" } },
  { name: "dashboard_financeiro", arguments: {} },
  { name: "engenharia_cardapio", arguments: { inicio: "2026-09-01", fim: "2026-09-30" } },
  { name: "posicao_caixa", arguments: { dataReferencia: "2026-10-01", projecaoAte: "2026-10-31" } },
  { name: "extrato_caixa", arguments: { inicio: "2026-09-01", fim: "2026-09-30" } },
  { name: "contas_a_pagar", arguments: { inicio: "2026-09-01", fim: "2026-10-31" } },
  { name: "estoque", arguments: {} },
];
