import { PaymentReleaseSource, Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HistoricalOrderImportService } from "../src/ordering/historical-order-import.service";

const tenantId = "11111111-1111-4111-8111-111111111111";

describe("historical order payment release import", () => {
  const prismaMock = {
    product: { findMany: vi.fn() },
    order: { findMany: vi.fn(), create: vi.fn() },
    orderPlatform: { upsert: vi.fn() },
    paymentInstitutionConfiguration: { findMany: vi.fn(), findFirst: vi.fn() },
    externalSaleIdentity: { create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn((callback: (client: unknown) => unknown) => callback(prismaMock)),
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
    prismaMock.paymentInstitutionConfiguration.findMany.mockResolvedValue([]);
    prismaMock.paymentInstitutionConfiguration.findFirst.mockResolvedValue(null);
    prismaMock.order.findMany.mockResolvedValue([]);
    prismaMock.orderPlatform.upsert.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
    });
    prismaMock.order.create.mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
    });
    profitabilityMock.createDeliveredOrderSnapshots.mockResolvedValue(undefined);
    prismaMock.externalSaleIdentity.create.mockResolvedValue({ id: "identity" });
    prismaMock.externalSaleIdentity.update.mockResolvedValue({ id: "identity" });
    prismaMock.externalSaleIdentity.deleteMany.mockResolvedValue({ count: 0 });
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
    expect(prismaMock.externalSaleIdentity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId,
        provider: "PAGBANK",
        externalSaleId: "pag-1",
        firstChannel: "FILE",
      }),
    });
    expect(prismaMock.externalSaleIdentity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orderId: "44444444-4444-4444-8444-444444444444" }),
      })
    );
  });

  it("preserves the SIMPLE layout through the shared import pipeline", async () => {
    const result = await service.importFromCsv(tenantId, {
      csvText: "Data;Descricao;Valor\n30/05/2026;Venda balcão;20,00",
      layout: "SIMPLE",
    });

    expect(result).toMatchObject({ parsedRows: 1, importedCount: 1, skippedCount: 0 });
    expect(prismaMock.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ total: new Prisma.Decimal("20.00") }),
    });
  });

  it("imports an API sale directly from the normalized contract", async () => {
    const onOrderCreated = vi.fn().mockResolvedValue(undefined);
    const result = await service.importNormalizedSale(
      tenantId,
      {
        provider: "PAGBANK",
        channel: "API",
        providerMovementId: "movement-1",
        externalSaleId: "sale-1",
        occurredAt: "2026-05-30T17:54:00.000Z",
        grossAmount: 25,
        feeAmount: 1,
        netAmount: 24,
        paymentMethod: "PIX",
        paymentBrand: "PagBank",
      },
      { onOrderCreated }
    );

    expect(result.importedCount).toBe(1);
    expect(prismaMock.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        externalPaymentId: "sale-1",
        paymentGrossAmount: new Prisma.Decimal(25),
        paymentFeeAmount: new Prisma.Decimal(1),
        paymentNetAmount: new Prisma.Decimal(24),
      }),
    });
    expect(onOrderCreated).toHaveBeenCalledWith(prismaMock, "44444444-4444-4444-8444-444444444444");
    expect(profitabilityMock.createDeliveredOrderSnapshots).toHaveBeenCalledWith(
      tenantId,
      "44444444-4444-4444-8444-444444444444",
      prismaMock
    );
  });

  it("allocates a Mercado Pago API sale to the configured Mercado Pago account", async () => {
    prismaMock.paymentInstitutionConfiguration.findFirst.mockResolvedValue({
      id: "55555555-5555-4555-8555-555555555555",
      name: "Mercado Pago",
      paymentInstitution: "MERCADO_PAGO",
    });

    const result = await service.importNormalizedSale(tenantId, {
      provider: "MERCADO_PAGO",
      channel: "API",
      providerMovementId: "movement-mp-1",
      externalSaleId: "payment-mp-1",
      occurredAt: "2026-07-18T22:50:48.000-04:00",
      grossAmount: 68,
      paymentMethod: "DIGITAL_WALLET",
      paymentBrand: "account_money",
    });

    expect(prismaMock.paymentInstitutionConfiguration.findFirst).toHaveBeenCalledWith({
      where: { tenantId, paymentInstitution: "MERCADO_PAGO" },
      select: { id: true, name: true, paymentInstitution: true },
    });
    expect(prismaMock.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentInstitution: "MERCADO_PAGO",
        paymentInstitutionId: "55555555-5555-4555-8555-555555555555",
        createdAt: new Date("2026-07-18T22:50:48.000-04:00"),
      }),
    });
    expect(result.imported[0]).toMatchObject({
      paymentInstitution: "MERCADO_PAGO",
      paymentInstitutionId: "55555555-5555-4555-8555-555555555555",
      paymentInstitutionName: "Mercado Pago",
    });
  });

  it("rejects an invalid normalized sale before touching persistence", async () => {
    await expect(
      service.importNormalizedSale(tenantId, {
        provider: "PAGBANK",
        channel: "API",
        providerMovementId: "movement-1",
        externalSaleId: "",
        occurredAt: "invalid",
        grossAmount: 0,
        paymentMethod: "PIX",
      })
    ).rejects.toThrow(/normalizada invalida/);
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });
});
