import { Injectable, Optional } from "@nestjs/common";
import { PaymentMethod, Prisma } from "@prisma/client";
import { NormalizedHistoricalSale } from "../../../ordering/historical-order-import.service";
import { PrismaService } from "../../../platform/database/prisma.service";
import { IfoodFinancialObservabilityService } from "./ifood-financial-observability.service";

type PersistenceClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class IfoodFinancialSaleService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly observability?: IfoodFinancialObservabilityService
  ) {}

  persist(input: {
    tenantId: string;
    integrationId: string;
    environment: "TEST" | "PRODUCTION";
    externalMerchantId: string;
    orderId: string;
    sale: NormalizedHistoricalSale;
    client?: PersistenceClient;
  }) {
    const client = input.client ?? this.prisma;
    return this.persistWith(client, input);
  }

  private async persistWith(
    client: PersistenceClient,
    input: {
      tenantId: string;
      integrationId: string;
      environment: "TEST" | "PRODUCTION";
      externalMerchantId: string;
      orderId: string;
      sale: NormalizedHistoricalSale;
    }
  ) {
    const raw = objectValue(input.sale.raw);
    const gross = objectValue(raw.saleGrossValue);
    const benefits = objectValue(raw.benefits);
    const billing = objectValue(raw.billingSummary);
    const paymentsObject = objectValue(raw.payments);
    const payments = Array.isArray(paymentsObject.methods) ? paymentsObject.methods : [];
    const existing = await client.externalFinancialSale.findUnique({
      where: {
        tenantId_provider_environment_externalSaleId: {
          tenantId: input.tenantId,
          provider: "IFOOD",
          environment: input.environment,
          externalSaleId: input.sale.externalSaleId,
        },
      },
      select: { id: true },
    });
    const canonical = await client.externalFinancialSale.upsert({
      where: {
        tenantId_provider_environment_externalSaleId: {
          tenantId: input.tenantId,
          provider: "IFOOD",
          environment: input.environment,
          externalSaleId: input.sale.externalSaleId,
        },
      },
      create: {
        tenantId: input.tenantId,
        integrationId: input.integrationId,
        environment: input.environment,
        provider: "IFOOD",
        externalSaleId: input.sale.externalSaleId,
        externalMerchantId: input.externalMerchantId,
        shortId: text(raw.shortId),
        orderId: input.orderId,
        status: text(raw.currentStatus) ?? "CONCLUDED",
        category: text(raw.category),
        salesChannel: text(raw.salesChannel),
        occurredAt: new Date(input.sale.occurredAt),
        merchantTimezone: text(objectValue(raw.merchant).timezone) ?? "America/Sao_Paulo",
        bagAmount: decimal(gross.bag, input.sale.grossAmount),
        deliveryFeeAmount: decimal(gross.deliveryFee, 0),
        serviceFeeAmount: decimal(gross.serviceFee, 0),
        benefitsAmount: decimal(benefits.totalValue, 0),
        customerPaidAmount: decimal(
          payments.reduce((sum, value) => sum + number(objectValue(value).value, 0), 0),
          input.sale.grossAmount
        ),
        saleBalanceAmount: decimal(billing.saleBalance, input.sale.netAmount ?? 0),
        rawPayload: raw as Prisma.InputJsonObject,
        lastSyncedAt: new Date(),
      },
      update: {
        integrationId: input.integrationId,
        externalMerchantId: input.externalMerchantId,
        orderId: input.orderId,
        status: text(raw.currentStatus) ?? "CONCLUDED",
        bagAmount: decimal(gross.bag, input.sale.grossAmount),
        deliveryFeeAmount: decimal(gross.deliveryFee, 0),
        serviceFeeAmount: decimal(gross.serviceFee, 0),
        benefitsAmount: decimal(benefits.totalValue, 0),
        customerPaidAmount: decimal(
          payments.reduce((sum, value) => sum + number(objectValue(value).value, 0), 0),
          input.sale.grossAmount
        ),
        saleBalanceAmount: decimal(billing.saleBalance, input.sale.netAmount ?? 0),
        rawPayload: raw as Prisma.InputJsonObject,
        lastSyncedAt: new Date(),
      },
    });
    this.observability?.dedupeChecked({
      tenantId: input.tenantId,
      integrationId: input.integrationId,
      externalSaleId: input.sale.externalSaleId,
      outcome: existing ? "UPDATED" : "CREATED",
    });
    await client.externalSalePayment.deleteMany({ where: { saleId: canonical.id } });
    for (const [index, value] of payments.entries()) {
      const payment = objectValue(value);
      const rawMethod = methodName(payment.method);
      const installment = objectValue(payment.installment);
      const details = Array.isArray(installment.installmentDetail)
        ? installment.installmentDetail
        : [];
      await client.externalSalePayment.create({
        data: {
          tenantId: input.tenantId,
          saleId: canonical.id,
          providerPaymentKey: `${index}:${rawMethod}:${number(payment.value, 0).toFixed(2)}`,
          providerMethod: rawMethod,
          mappedMethod: mapMethod(rawMethod),
          paymentType: text(payment.type),
          liability: text(payment.liability) ?? "UNKNOWN",
          amount: decimal(payment.value, 0),
          currency: text(payment.currency) ?? "BRL",
          brand: text(objectValue(payment.card).brand),
          nsu: masked(text(objectValue(payment.transaction).nsu)),
          acquirerDocumentMasked: masked(text(objectValue(payment.transaction).acquirerDocument)),
          installmentCount: integer(installment.maxInstallments),
          installments: {
            create: details.map((detailValue, detailIndex) => {
              const detail = objectValue(detailValue);
              return {
                tenantId: input.tenantId,
                reference: text(detail.reference) ?? String(detailIndex + 1),
                sequence: integer(detail.sequence) ?? detailIndex + 1,
                amount: decimal(detail.amount, 0),
                expectedPaymentDate: date(text(detail.expectedPaymentDate)),
                status: text(detail.status),
                settledAt: date(text(detail.settledAt)),
              };
            }),
          },
        },
      });
    }
    return canonical;
  }
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function text(value: unknown): string | null {
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}
function number(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function decimal(value: unknown, fallback: number) {
  return new Prisma.Decimal(number(value, fallback));
}
function integer(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
function date(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}
function methodName(value: unknown): string {
  return typeof value === "string" ? value : (text(objectValue(value).method) ?? "UNKNOWN");
}
function mapMethod(value: string): PaymentMethod | null {
  const map: Record<string, PaymentMethod> = {
    CASH: PaymentMethod.CASH,
    PIX: PaymentMethod.PIX,
    PIX_MANUAL: PaymentMethod.PIX_MANUAL,
    CARD_ON_DELIVERY: PaymentMethod.CARD_ON_DELIVERY,
    DEBIT: PaymentMethod.DEBIT_CARD,
    DEBIT_CARD: PaymentMethod.DEBIT_CARD,
    CREDIT: PaymentMethod.CREDIT_CARD,
    CREDIT_CARD: PaymentMethod.CREDIT_CARD,
    MEAL_VOUCHER: PaymentMethod.VOUCHER,
    FOOD_VOUCHER: PaymentMethod.VOUCHER,
    VOUCHER: PaymentMethod.VOUCHER,
    DIGITAL_WALLET: PaymentMethod.DIGITAL_WALLET,
    WALLET: PaymentMethod.DIGITAL_WALLET,
  };
  return map[value] ?? null;
}
function masked(value: string | null): string | null {
  if (!value) return null;
  return `****${value.replace(/\D/g, "").slice(-4)}`;
}
