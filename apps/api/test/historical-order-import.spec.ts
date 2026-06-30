import { PaymentReleaseSource, Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HistoricalOrderImportService } from "../src/ordering/historical-order-import.service";

const tenantId = "11111111-1111-4111-8111-111111111111";

describe("historical order payment release import", () => {
  const prismaMock = {
    product: { findMany: vi.fn() },
    order: { findMany: vi.fn(), create: vi.fn() },
    orderPlatform: { upsert: vi.fn() },
  };
  const profitabilityMock = {
    createDeliveredOrderSnapshots: vi.fn(),
  };
  const service = new HistoricalOrderImportService(prismaMock as never, profitabilityMock as never);

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.product.findMany.mockResolvedValue([
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "X-BURGUER",
        price: new Prisma.Decimal("20.00"),
      },
    ]);
    prismaMock.order.findMany.mockResolvedValue([]);
    prismaMock.orderPlatform.upsert.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
    });
    prismaMock.order.create.mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
    });
    profitabilityMock.createDeliveredOrderSnapshots.mockResolvedValue(undefined);
  });

  it("persists Mercado Pago RELEASE_DATETIME from the extract", async () => {
    const csvText = [
      "OPERATION_DATETIME;RELEASE_DATETIME;MOVEMENT_TYPE;PAYMENT_ID;LOCAL;CHARGE_METHOD;PAYMENT_METHOD_DETAIL;PAYMENT_METHOD;GROSS_VALUE;SALES_DISCOUNTS;NET",
      "30-05-2026 18:00:00;29-06-2026 18:00:00;Pagamento;mp-1;;Cartao;Credito;Visa;30,00;-1,50;28,50",
    ].join("\n");

    const result = await service.importFromCsv(tenantId, { csvText, layout: "MERCADO_PAGO" });

    expect(prismaMock.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentReleaseExpectedAt: new Date(2026, 5, 29, 18, 0, 0, 0),
        paymentReleaseSource: PaymentReleaseSource.EXTRACT,
      }),
    });
    expect(result.imported[0]).toMatchObject({
      paymentReleaseSource: PaymentReleaseSource.EXTRACT,
    });
  });

  it("uses D+30 when PagBank release date is empty", async () => {
    const csvText = [
      "Data da Transação;Data prevista de liberação;Código da Transação;Bandeira;Forma de Pagamento;Valor Bruto;Valor Taxa;Valor Líquido;Status",
      "30/05/2026 17:54;;pag-1;Ticket;Voucher;17,00;0,00;17,00;Aprovada",
    ].join("\n");

    const result = await service.importFromCsv(tenantId, { csvText, layout: "PAGBANK" });

    expect(prismaMock.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentReleaseExpectedAt: new Date(2026, 5, 29, 17, 54, 0, 0),
        paymentReleaseSource: PaymentReleaseSource.D_PLUS_30_FALLBACK,
      }),
    });
    expect(result.imported[0]).toMatchObject({
      paymentReleaseSource: PaymentReleaseSource.D_PLUS_30_FALLBACK,
    });
  });
});
