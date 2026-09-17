export const IFOOD_FINANCIAL_MERCHANT_ID = "550e8400-e29b-41d4-a716-446655440000";
export const IFOOD_FINANCIAL_ORDER_ID = "8fc68e90-842c-44a7-95f6-9defaa01a001";

export const ifoodSalesFixture = {
  page: 0,
  size: 100,
  beginSalesDate: "2026-09-01",
  endSalesDate: "2026-09-01",
  total: 1,
  pageCount: 1,
  sales: [
    {
      id: IFOOD_FINANCIAL_ORDER_ID,
      shortId: "1042",
      createdAt: "2026-09-01T23:30:00.000Z",
      type: "ORDER",
      category: "FOOD",
      salesChannel: "IFOOD",
      currentStatus: "CONCLUDED",
      merchant: {
        id: IFOOD_FINANCIAL_MERCHANT_ID,
        name: "Loja de homologacao",
        type: "RESTAURANT",
        timezone: "America/Sao_Paulo",
        documents: [{ type: "CNPJ", value: "00000000000000" }],
      },
      saleGrossValue: { bag: 50, deliveryFee: 8, serviceFee: 1 },
      benefits: {
        benefits: [
          {
            target: "ITEM",
            value: 5,
            sponsorships: [{ name: "IFOOD", value: 5 }],
          },
        ],
        totalValue: 5,
      },
      payments: {
        methods: [
          {
            method: "PIX",
            currency: "BRL",
            type: "ONLINE",
            value: 54,
            liability: "IFOOD",
            transaction: { nsu: "redacted-fixture" },
          },
        ],
      },
      billingSummary: {
        saleBalance: 42,
        billingEntries: [
          { name: "ORDER_PAYMENT", value: 54 },
          { name: "ORDER_COMMISSION", value: -12 },
        ],
      },
      orderStatusHistory: [{ value: "CONCLUDED", createdAt: "2026-09-02T00:10:00.000Z" }],
      orderEvents: [],
    },
  ],
} as const;

export const ifoodFinancialEventsFixture = {
  page: 1,
  size: 100,
  hasNextPage: false,
  financialEvents: [
    {
      name: "ORDER_COMMISSION",
      description: "Comissao da venda",
      product: "IFOOD",
      trigger: "SALE_CONCLUDED",
      competence: "2026-09",
      reference: {
        type: "ORDER",
        id: IFOOD_FINANCIAL_ORDER_ID,
        date: "2026-09-01T23:30:00.000Z",
      },
      hasTransferImpact: true,
      amount: { value: "-12.00" },
      billing: { baseValue: "50.00", feePercentage: "24.00" },
      settlement: { expectedDate: "2026-09-09" },
    },
  ],
} as const;

export const ifoodSettlementsFixture = {
  balance: "42.00",
  settlements: [
    {
      id: "settlement-2026-09-01",
      product: "IFOOD",
      status: "SUCCEED",
      closingItems: [
        {
          id: "closing-item-1",
          type: "REPASSE",
          status: "SUCCEED",
          amount: "42.00",
          expectedPaymentDate: "2026-09-09",
          paymentDate: "2026-09-09T12:00:00.000Z",
        },
      ],
    },
  ],
} as const;

export const ifoodReconciliationFileFixture = {
  requestId: "reconciliation-request-1",
  status: "READY",
  competencia: "2026-09",
  orderCount: 1,
  lineCount: 2,
  downloadUrl: "https://files.example.invalid/reconciliation.csv.gz",
  expiresAt: "2026-09-04T15:00:00.000Z",
} as const;
