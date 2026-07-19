import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  FulfillmentMethod,
  OrderStatus,
  PaymentInstitution,
  PaymentMethod,
  PaymentReleaseSource,
  Prisma,
} from "@prisma/client";
import { createHash } from "node:crypto";
import { OrderProfitabilityService } from "../management/reports/order-profitability.service";
import { PrismaService } from "../platform/database/prisma.service";
import {
  HistoricalOrderImportLayout,
  HistoricalOrderImportStrategy,
  ImportOrdersDto,
} from "./dto/import-orders.dto";

interface ParsedImportRow {
  rowNumber: number;
  date: Date;
  description: string;
  amount: Prisma.Decimal;
  feeAmount?: Prisma.Decimal;
  netAmount?: Prisma.Decimal;
  paymentInstitutionId?: string;
  paymentInstitutionName?: string;
  paymentInstitution?: PaymentInstitution;
  paymentMethod?: PaymentMethod;
  externalPaymentId?: string;
  paymentBrand?: string;
  paymentReleaseExpectedAt?: Date;
  paymentReleaseSource?: PaymentReleaseSource;
  importKey: string;
}

interface ProductCandidate {
  id: string;
  name: string;
  price: Prisma.Decimal;
}

interface ImportedOrderResult {
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

interface ResolvedPaymentInstitution {
  id: string;
  name: string;
  paymentInstitution: PaymentInstitution | null;
}

interface PaymentInstitutionOption extends ResolvedPaymentInstitution {
  code: string;
}

interface ParsedPaymentInstitution {
  paymentInstitutionId?: string;
  paymentInstitutionName?: string;
  paymentInstitution?: PaymentInstitution;
}

interface SkippedOrderResult {
  rowNumber: number;
  reason: string;
}

export interface NormalizedHistoricalSaleImportOptions {
  strategy?: HistoricalOrderImportStrategy;
  fixedProductId?: string;
  orderPlatformName?: string;
  onOrderCreated?: (client: Prisma.TransactionClient, orderId: string) => Promise<void>;
}

export interface NormalizedHistoricalSale {
  provider: "PAGBANK";
  channel: "API" | "FILE" | "OTHER";
  providerMovementId: string;
  externalSaleId: string;
  occurredAt: string;
  grossAmount: number;
  netAmount?: number;
  feeAmount?: number;
  paymentMethod: "PIX" | "PIX_MANUAL" | "DEBIT_CARD" | "CREDIT_CARD";
  paymentBrand?: string;
  expectedReleaseAt?: string;
}

@Injectable()
export class HistoricalOrderImportService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OrderProfitabilityService)
    private readonly orderProfitabilityService: OrderProfitabilityService
  ) {}

  async importFromCsv(tenantId: string, dto: ImportOrdersDto) {
    const layout = dto.layout ?? "SIMPLE";
    const institutionOptions = await this.listPaymentInstitutionOptions(tenantId);
    const rows = this.parseCsv(dto.csvText, layout, institutionOptions);

    return this.importRows(tenantId, rows, dto, layout);
  }

  async importNormalizedSale(
    tenantId: string,
    sale: NormalizedHistoricalSale,
    options: NormalizedHistoricalSaleImportOptions = {}
  ) {
    const amount = new Prisma.Decimal(sale.grossAmount);
    const occurredAt = new Date(sale.occurredAt);
    if (!sale.externalSaleId.trim() || !Number.isFinite(sale.grossAmount) || amount.lte(0)) {
      throw new BadRequestException("Venda normalizada invalida");
    }
    if (Number.isNaN(occurredAt.getTime())) throw new BadRequestException("Data da venda normalizada invalida");
    const paymentMethod = PaymentMethod[sale.paymentMethod];
    if (!paymentMethod) throw new BadRequestException("Meio de pagamento normalizado invalido");
    const paymentInstitution = sale.provider === "PAGBANK" ? PaymentInstitution.PAGBANK : undefined;
    const release = this.resolvePaymentRelease(
      occurredAt,
      sale.expectedReleaseAt ? new Date(sale.expectedReleaseAt) : undefined,
      { paymentInstitution, paymentMethod }
    );
    const row: ParsedImportRow = {
      rowNumber: 1,
      date: occurredAt,
      description: `${sale.provider} ${sale.providerMovementId}`,
      amount,
      feeAmount: sale.feeAmount === undefined ? undefined : new Prisma.Decimal(sale.feeAmount),
      netAmount: sale.netAmount === undefined ? undefined : new Prisma.Decimal(sale.netAmount),
      paymentInstitution,
      paymentMethod,
      externalPaymentId: sale.externalSaleId,
      paymentBrand: sale.paymentBrand,
      paymentReleaseExpectedAt: release.expectedAt,
      paymentReleaseSource: release.source,
      importKey: this.externalImportKey(paymentInstitution ?? PaymentInstitution.CAIXA_LOCAL, sale.externalSaleId),
    };
    return this.importRows(tenantId, [row], {
      strategy: options.strategy ?? "PRICE_WEIGHTED",
      fixedProductId: options.fixedProductId,
      orderPlatformName: options.orderPlatformName ?? `${sale.provider}_${sale.channel}`,
      paymentInstitution,
      paymentMethod,
      onOrderCreated: options.onOrderCreated,
    }, `${sale.provider}_${sale.channel}`);
  }

  private async importRows(
    tenantId: string,
    rows: ParsedImportRow[],
    dto: Pick<ImportOrdersDto, "strategy" | "fixedProductId" | "orderPlatformName" | "paymentInstitutionId" | "paymentInstitution" | "paymentMethod"> &
      Pick<NormalizedHistoricalSaleImportOptions, "onOrderCreated">,
    layout: string
  ) {
    const strategy = dto.strategy ?? "PRICE_WEIGHTED";

    if (rows.length === 0) {
      throw new BadRequestException("Nenhuma venda valida encontrada");
    }

    const [products, existingKeys, orderPlatform, defaultInstitution] = await Promise.all([
      this.getProductCandidates(tenantId, dto.fixedProductId, strategy),
      this.findExistingRows(
        tenantId,
        rows.map((row) => ({
          importKey: row.importKey,
          externalPaymentId: row.externalPaymentId,
        }))
      ),
      this.upsertOrderPlatform(tenantId, dto.orderPlatformName ?? "FOOD_TRUCK"),
      this.resolveDefaultPaymentInstitution(tenantId, dto),
    ]);

    const imported: ImportedOrderResult[] = [];
    const skipped: SkippedOrderResult[] = [];

    for (const row of rows) {
      if (existingKeys.has(row.importKey)) {
        skipped.push({ rowNumber: row.rowNumber, reason: "Linha ja importada" });
        continue;
      }

      const product = this.pickProduct(products, row, strategy, dto.fixedProductId);
      const rowInstitution = row.paymentInstitutionId
        ? {
            id: row.paymentInstitutionId,
            name:
              row.paymentInstitutionName ??
              paymentInstitutionLabel(row.paymentInstitution ?? null) ??
              "",
            paymentInstitution: row.paymentInstitution ?? null,
          }
        : await this.resolveRowPaymentInstitution(
            tenantId,
            row.paymentInstitution,
            defaultInstitution
          );
      const paymentInstitution =
        row.paymentInstitution ?? rowInstitution?.paymentInstitution ?? dto.paymentInstitution;
      const paymentInstitutionId = rowInstitution?.id ?? null;
      const paymentInstitutionName =
        rowInstitution?.name ?? paymentInstitutionLabel(paymentInstitution ?? null);
      const paymentMethod = row.paymentMethod ?? dto.paymentMethod ?? PaymentMethod.PIX_MANUAL;
      const csvIdentityKey =
        layout === "PAGBANK" && row.externalPaymentId
          ? { tenantId, provider: "PAGBANK" as const, externalSaleId: row.externalPaymentId }
          : null;
      if (csvIdentityKey) {
        try {
          await this.prisma.externalSaleIdentity.create({
            data: { ...csvIdentityKey, firstChannel: "FILE" },
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            skipped.push({ rowNumber: row.rowNumber, reason: "Venda externa ja importada" });
            continue;
          }
          throw error;
        }
      }
      const order = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.order.create({
          data: {
          tenantId,
          status: OrderStatus.DELIVERED,
          total: row.amount,
          customerName: "Cliente importado",
          customerPhone: "00000000000",
          fulfillmentMethod: FulfillmentMethod.PICKUP,
          paymentMethod,
          paymentInstitution,
          paymentInstitutionId,
          externalPaymentId: row.externalPaymentId,
          paymentGrossAmount: row.amount,
          paymentFeeAmount: row.feeAmount,
          paymentNetAmount: row.netAmount,
          paymentBrand: row.paymentBrand,
          paymentReleaseExpectedAt: row.paymentReleaseExpectedAt,
          paymentReleaseSource: row.paymentReleaseSource,
          orderPlatformId: orderPlatform.id,
          notes: this.buildImportNote(row, product, strategy, layout, {
            paymentInstitution,
            paymentInstitutionName,
            paymentMethod,
          }),
          createdAt: row.date,
          updatedAt: row.date,
          items: {
            create: {
              tenantId,
              productId: product.id,
              productNameSnapshot: product.name,
              quantity: 1,
              unitPrice: row.amount,
              total: row.amount,
            },
          },
          },
        });
        await this.orderProfitabilityService.createDeliveredOrderSnapshots(
          tenantId,
          created.id,
          transaction
        );
        if (csvIdentityKey) {
          await transaction.externalSaleIdentity.update({
            where: { tenantId_provider_externalSaleId: csvIdentityKey },
            data: { orderId: created.id, importedAt: new Date() },
          });
        }
        await dto.onOrderCreated?.(transaction, created.id);
        return created;
      }).catch(async (error: unknown) => {
        if (csvIdentityKey) {
          await this.prisma.externalSaleIdentity.deleteMany({
            where: { ...csvIdentityKey, orderId: null },
          });
        }
        throw error;
      });
      existingKeys.add(row.importKey);

      imported.push({
        rowNumber: row.rowNumber,
        orderId: order.id,
        date: row.date.toISOString(),
        amount: row.amount.toFixed(2),
        productId: product.id,
        productName: product.name,
        paymentInstitution: paymentInstitution ?? null,
        paymentInstitutionId,
        paymentInstitutionName,
        paymentMethod,
        externalPaymentId: row.externalPaymentId ?? null,
        grossAmount: row.amount.toFixed(2),
        feeAmount: row.feeAmount?.toFixed(2) ?? null,
        netAmount: row.netAmount?.toFixed(2) ?? null,
        paymentReleaseExpectedAt: row.paymentReleaseExpectedAt?.toISOString() ?? null,
        paymentReleaseSource: row.paymentReleaseSource ?? null,
      });
    }

    return {
      parsedRows: rows.length,
      importedCount: imported.length,
      skippedCount: skipped.length,
      imported,
      skipped,
    };
  }

  private async getProductCandidates(
    tenantId: string,
    fixedProductId: string | undefined,
    strategy: HistoricalOrderImportStrategy
  ): Promise<ProductCandidate[]> {
    const products = await this.prisma.product.findMany({
      where: {
        tenantId,
        active: true,
        ...(strategy === "FIXED_PRODUCT" && fixedProductId ? { id: fixedProductId } : {}),
      },
      select: {
        id: true,
        name: true,
        price: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    if (products.length === 0) {
      throw new BadRequestException("Nenhum produto ativo disponivel para atribuir pedidos");
    }

    if (strategy === "FIXED_PRODUCT" && !fixedProductId) {
      throw new BadRequestException("Informe um produto para a estrategia FIXED_PRODUCT");
    }

    return products;
  }

  private async findExistingRows(
    tenantId: string,
    rows: Array<{ importKey: string; externalPaymentId?: string }>
  ): Promise<Set<string>> {
    const importKeys = rows.map((row) => row.importKey);
    const externalIds = rows
      .map((row) => row.externalPaymentId)
      .filter((id): id is string => Boolean(id));
    const existing = await this.prisma.order.findMany({
      where: {
        tenantId,
        OR: [
          ...importKeys.map((key) => ({
            notes: {
              contains: `importKey=${key}`,
            },
          })),
          ...(externalIds.length > 0
            ? [
                {
                  externalPaymentId: {
                    in: externalIds,
                  },
                },
              ]
            : []),
        ],
      },
      select: {
        notes: true,
        externalPaymentId: true,
      },
    });

    const keys = new Set<string>();

    for (const order of existing) {
      const importKey = order.notes?.match(/importKey=([a-f0-9]+)/)?.[1];

      if (importKey) {
        keys.add(importKey);
      }

      if (order.externalPaymentId) {
        const row = rows.find(
          (candidate) => candidate.externalPaymentId === order.externalPaymentId
        );

        if (row) {
          keys.add(row.importKey);
        }
      }
    }

    return keys;
  }

  private async upsertOrderPlatform(tenantId: string, name: string) {
    const platformName = name.trim() || "FOOD_TRUCK";

    return this.prisma.orderPlatform.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: platformName,
        },
      },
      update: {
        active: true,
      },
      create: {
        tenantId,
        name: platformName,
        feeRate: 0,
        paymentFeeRate: 0,
        active: true,
      },
    });
  }

  private async listPaymentInstitutionOptions(
    tenantId: string
  ): Promise<PaymentInstitutionOption[]> {
    return this.prisma.paymentInstitutionConfiguration.findMany({
      where: { tenantId, active: true },
      select: { id: true, name: true, code: true, paymentInstitution: true },
      orderBy: { name: "asc" },
    });
  }

  private async resolveDefaultPaymentInstitution(
    tenantId: string,
    dto: Pick<ImportOrdersDto, "paymentInstitutionId" | "paymentInstitution">
  ): Promise<ResolvedPaymentInstitution | null> {
    if (dto.paymentInstitutionId) {
      const institution = await this.prisma.paymentInstitutionConfiguration.findFirst({
        where: { id: dto.paymentInstitutionId, tenantId, active: true },
        select: { id: true, name: true, paymentInstitution: true },
      });

      if (!institution) {
        throw new BadRequestException("Instituicao financeira padrao nao encontrada");
      }

      return institution;
    }

    if (!dto.paymentInstitution) {
      return null;
    }

    return this.resolveRowPaymentInstitution(tenantId, dto.paymentInstitution, null);
  }

  private async resolveRowPaymentInstitution(
    tenantId: string,
    paymentInstitution: PaymentInstitution | undefined,
    fallback: ResolvedPaymentInstitution | null
  ): Promise<ResolvedPaymentInstitution | null> {
    if (!paymentInstitution) {
      return fallback;
    }

    const institution = await this.prisma.paymentInstitutionConfiguration.findFirst({
      where: { tenantId, paymentInstitution },
      select: { id: true, name: true, paymentInstitution: true },
    });

    return institution ?? fallback;
  }

  private parseCsv(
    csvText: string,
    layout: HistoricalOrderImportLayout,
    institutionOptions: PaymentInstitutionOption[]
  ): ParsedImportRow[] {
    const lines = csvText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      return [];
    }

    const header = this.parseHeader(lines[0]);

    return lines
      .slice(1)
      .map((line, index) => this.parseLine(line, index + 2, header, layout, institutionOptions))
      .filter((row): row is ParsedImportRow => Boolean(row));
  }

  private parseLine(
    line: string,
    rowNumber: number,
    header: Map<string, number>,
    layout: HistoricalOrderImportLayout,
    institutionOptions: PaymentInstitutionOption[]
  ): ParsedImportRow | null {
    const columns = line.split(";");

    if (layout === "MERCADO_PAGO") {
      return this.parseMercadoPagoLine(columns, header, rowNumber);
    }

    if (layout === "PAGBANK") {
      return this.parsePagBankLine(columns, header, rowNumber);
    }

    return this.parseSimpleLine(columns, header, rowNumber, institutionOptions);
  }

  private parseSimpleLine(
    columns: string[],
    header: Map<string, number>,
    rowNumber: number,
    institutionOptions: PaymentInstitutionOption[]
  ): ParsedImportRow | null {
    const dateText = this.column(columns, header, "data") ?? columns[0] ?? "";
    const amountText = this.column(columns, header, "valor") ?? columns[columns.length - 1] ?? "";
    const description =
      this.column(columns, header, "descricao") ??
      this.column(columns, header, "produto") ??
      (columns.length >= 3 ? columns.slice(1, -1).join(";") : "");
    const amount = this.parseDecimal(amountText);

    if (!amount || amount.lte(0) || this.isNonOrderTransaction(description)) {
      return null;
    }

    const paymentInstitutionText =
      this.column(columns, header, "instituicao") ??
      this.column(columns, header, "instituicao de pagamento");
    const parsedInstitution = this.parsePaymentInstitution(
      paymentInstitutionText,
      institutionOptions
    );
    const paymentMethod = this.parsePaymentMethod(
      this.column(columns, header, "meio") ??
        this.column(columns, header, "meio de pagamento") ??
        this.column(columns, header, "pagamento")
    );
    const date = this.parseDate(dateText, rowNumber);
    const effectiveDate = this.withImportTime(date, rowNumber);
    const paymentRelease = this.resolvePaymentRelease(effectiveDate, undefined, {
      paymentInstitution: parsedInstitution.paymentInstitution,
      paymentMethod,
    });
    const importKey = createHash("sha256")
      .update(
        `${rowNumber}|${dateText}|${description}|${amount.toFixed(2)}|${
          parsedInstitution.paymentInstitutionId ??
          parsedInstitution.paymentInstitution ??
          this.normalize(paymentInstitutionText ?? "")
        }|${paymentMethod ?? ""}`
      )
      .digest("hex")
      .slice(0, 16);

    return {
      rowNumber,
      date: effectiveDate,
      description: description.trim(),
      amount,
      paymentInstitutionId: parsedInstitution.paymentInstitutionId,
      paymentInstitutionName: parsedInstitution.paymentInstitutionName,
      paymentInstitution: parsedInstitution.paymentInstitution,
      paymentMethod,
      paymentReleaseExpectedAt: paymentRelease.expectedAt,
      paymentReleaseSource: paymentRelease.source,
      importKey,
    };
  }

  private parseMercadoPagoLine(
    columns: string[],
    header: Map<string, number>,
    rowNumber: number
  ): ParsedImportRow | null {
    const movementType = this.column(columns, header, "MOVEMENT_TYPE") ?? "";

    if (this.normalize(movementType) !== "pagamento") {
      return null;
    }

    const dateText = this.requiredColumn(columns, header, "OPERATION_DATETIME", rowNumber);
    const externalPaymentId = this.requiredColumn(columns, header, "PAYMENT_ID", rowNumber);
    const gross = this.parseRequiredDecimal(
      this.requiredColumn(columns, header, "GROSS_VALUE", rowNumber),
      rowNumber
    );
    const fee = this.parseRequiredDecimal(
      this.requiredColumn(columns, header, "SALES_DISCOUNTS", rowNumber),
      rowNumber
    ).abs();
    const net = this.parseRequiredDecimal(
      this.requiredColumn(columns, header, "NET", rowNumber),
      rowNumber
    );
    const methodDetail = this.column(columns, header, "PAYMENT_METHOD_DETAIL") ?? "";
    const brand = this.column(columns, header, "PAYMENT_METHOD") || undefined;
    const chargeMethod = this.column(columns, header, "CHARGE_METHOD") ?? "";
    const description = [chargeMethod, methodDetail, brand].filter(Boolean).join(" / ");
    const date = this.parseDateTime(dateText, rowNumber);
    const paymentMethod =
      this.parseKnownPaymentMethod(methodDetail) ??
      this.parseKnownPaymentMethod(chargeMethod) ??
      PaymentMethod.PIX;
    const paymentRelease = this.resolvePaymentRelease(
      date,
      this.parseOptionalDateTime(this.column(columns, header, "RELEASE_DATETIME"), rowNumber),
      {
        paymentInstitution: PaymentInstitution.MERCADO_PAGO,
        paymentMethod,
      }
    );
    const importKey = this.externalImportKey(PaymentInstitution.MERCADO_PAGO, externalPaymentId);

    return {
      rowNumber,
      date,
      description,
      amount: gross,
      feeAmount: fee,
      netAmount: net,
      paymentInstitution: PaymentInstitution.MERCADO_PAGO,
      paymentMethod,
      externalPaymentId,
      paymentBrand: brand,
      paymentReleaseExpectedAt: paymentRelease.expectedAt,
      paymentReleaseSource: paymentRelease.source,
      importKey,
    };
  }

  private parsePagBankLine(
    columns: string[],
    header: Map<string, number>,
    rowNumber: number
  ): ParsedImportRow | null {
    const status = this.column(columns, header, "Status") ?? "";

    if (this.normalize(status) !== "aprovada") {
      return null;
    }

    const dateText = this.requiredColumn(columns, header, "Data da Transação", rowNumber);
    const externalPaymentId = this.requiredColumn(
      columns,
      header,
      "Código da Transação",
      rowNumber
    );
    const gross = this.parseRequiredDecimal(
      this.requiredColumn(columns, header, "Valor Bruto", rowNumber),
      rowNumber
    );
    const fee = this.parseRequiredDecimal(
      this.requiredColumn(columns, header, "Valor Taxa", rowNumber),
      rowNumber
    ).abs();
    const net = this.parseRequiredDecimal(
      this.requiredColumn(columns, header, "Valor Líquido", rowNumber),
      rowNumber
    );
    const paymentText = this.requiredColumn(columns, header, "Forma de Pagamento", rowNumber);
    const brand = this.column(columns, header, "Bandeira") || undefined;
    const date = this.parseDateTime(dateText, rowNumber);
    const paymentMethod = this.parseKnownPaymentMethod(paymentText) ?? PaymentMethod.PIX;
    const paymentRelease = this.resolvePaymentRelease(
      date,
      this.parseOptionalDateTime(
        this.column(columns, header, "Data prevista de liberação") ??
          this.column(columns, header, "Data prevista de liberacao"),
        rowNumber
      ),
      {
        paymentInstitution: PaymentInstitution.PAGBANK,
        paymentMethod,
      }
    );
    const importKey = this.externalImportKey(PaymentInstitution.PAGBANK, externalPaymentId);

    return {
      rowNumber,
      date,
      description: [paymentText, brand].filter(Boolean).join(" / "),
      amount: gross,
      feeAmount: fee,
      netAmount: net,
      paymentInstitution: PaymentInstitution.PAGBANK,
      paymentMethod,
      externalPaymentId,
      paymentBrand: brand,
      paymentReleaseExpectedAt: paymentRelease.expectedAt,
      paymentReleaseSource: paymentRelease.source,
      importKey,
    };
  }

  private parseHeader(line: string): Map<string, number> {
    return new Map(
      line.split(";").map((column, index) => [this.normalize(column), index] as const)
    );
  }

  private column(columns: string[], header: Map<string, number>, name: string): string | undefined {
    const index = header.get(this.normalize(name));

    if (index === undefined) {
      return undefined;
    }

    return columns[index]?.trim();
  }

  private requiredColumn(
    columns: string[],
    header: Map<string, number>,
    name: string,
    rowNumber: number
  ): string {
    const value = this.column(columns, header, name);

    if (!value) {
      throw new BadRequestException(
        `Coluna obrigatoria ausente ou vazia: ${name} na linha ${rowNumber}`
      );
    }

    return value;
  }

  private parseDate(dateText: string, rowNumber: number): Date {
    const match = dateText.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

    if (!match) {
      throw new BadRequestException(`Data invalida na linha ${rowNumber}`);
    }

    const [, day, month, year] = match;
    return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0);
  }

  private parseDateTime(dateText: string, rowNumber: number): Date {
    const normalized = dateText.trim();
    const withSlash = normalized.match(
      /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/
    );
    const withDash = normalized.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
    const match = withSlash ?? withDash;

    if (!match) {
      return this.parseDate(normalized, rowNumber);
    }

    const [, day, month, year, hour, minute, second = "0"] = match;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      0
    );
  }

  private parseOptionalDateTime(dateText: string | undefined, rowNumber: number): Date | undefined {
    if (!dateText?.trim()) {
      return undefined;
    }

    return this.parseDateTime(dateText, rowNumber);
  }

  private withImportTime(date: Date, rowNumber: number): Date {
    const copy = new Date(date);
    copy.setMinutes(rowNumber % 60, rowNumber % 60, 0);
    return copy;
  }

  private resolvePaymentRelease(
    saleDate: Date,
    explicitReleaseDate: Date | undefined,
    payment: {
      paymentInstitution?: PaymentInstitution;
      paymentMethod?: PaymentMethod;
    }
  ):
    | { expectedAt: Date; source: PaymentReleaseSource }
    | { expectedAt: undefined; source: undefined } {
    if (explicitReleaseDate) {
      return { expectedAt: explicitReleaseDate, source: PaymentReleaseSource.EXTRACT };
    }

    if (this.isImmediatePayment(payment.paymentInstitution, payment.paymentMethod)) {
      return { expectedAt: saleDate, source: PaymentReleaseSource.IMMEDIATE };
    }

    const fallback = new Date(saleDate);
    fallback.setDate(fallback.getDate() + 30);
    return { expectedAt: fallback, source: PaymentReleaseSource.D_PLUS_30_FALLBACK };
  }

  private isImmediatePayment(
    paymentInstitution: PaymentInstitution | undefined,
    paymentMethod: PaymentMethod | undefined
  ): boolean {
    return (
      paymentInstitution === PaymentInstitution.DINHEIRO ||
      paymentInstitution === PaymentInstitution.CAIXA_LOCAL ||
      paymentMethod === PaymentMethod.CASH ||
      paymentMethod === PaymentMethod.PIX_MANUAL
    );
  }

  private parseDecimal(value: string): Prisma.Decimal | null {
    const normalized = value.trim().replace(/\./g, "").replace(",", ".");

    if (!normalized) {
      return null;
    }

    const numberValue = Number(normalized);

    if (!Number.isFinite(numberValue)) {
      return null;
    }

    return new Prisma.Decimal(numberValue);
  }

  private parseRequiredDecimal(value: string, rowNumber: number): Prisma.Decimal {
    const decimal = this.parseDecimal(value);

    if (!decimal) {
      throw new BadRequestException(`Valor numerico invalido na linha ${rowNumber}: ${value}`);
    }

    return decimal;
  }

  private isNonOrderTransaction(description: string): boolean {
    const normalized = this.normalize(description);

    return [
      "saldo anterior",
      "dinheiro retirado",
      "pix enviado",
      "pagamento de conta",
      "tarifa",
      "estorno",
    ].some((term) => normalized.includes(term));
  }

  private parsePaymentInstitution(
    value: string | undefined,
    institutionOptions: PaymentInstitutionOption[]
  ): ParsedPaymentInstitution {
    const normalized = this.normalize(value ?? "");

    if (!normalized) {
      return {};
    }

    if (normalized.includes("pagbank") || normalized.includes("pagseguro")) {
      return this.resolveParsedInstitution(PaymentInstitution.PAGBANK, institutionOptions);
    }

    if (normalized.includes("mercado")) {
      return this.resolveParsedInstitution(PaymentInstitution.MERCADO_PAGO, institutionOptions);
    }

    if (normalized.includes("dinheiro")) {
      return this.resolveParsedInstitution(PaymentInstitution.DINHEIRO, institutionOptions);
    }

    if (normalized.includes("caixa")) {
      return this.resolveParsedInstitution(PaymentInstitution.CAIXA_LOCAL, institutionOptions);
    }

    const customInstitution = institutionOptions.find(
      (institution) =>
        this.normalize(institution.name) === normalized ||
        this.normalize(institution.code) === normalized
    );

    if (customInstitution) {
      return {
        paymentInstitutionId: customInstitution.id,
        paymentInstitutionName: customInstitution.name,
        paymentInstitution: customInstitution.paymentInstitution ?? undefined,
      };
    }

    throw new BadRequestException(
      `Instituicao de pagamento invalida: ${value}. Cadastre a instituicao em Financeiro > Instituicoes ou selecione uma instituicao padrao.`
    );
  }

  private resolveParsedInstitution(
    paymentInstitution: PaymentInstitution,
    institutionOptions: PaymentInstitutionOption[]
  ): ParsedPaymentInstitution {
    const configuredInstitution = institutionOptions.find(
      (institution) => institution.paymentInstitution === paymentInstitution
    );

    return {
      paymentInstitutionId: configuredInstitution?.id,
      paymentInstitutionName:
        configuredInstitution?.name ?? paymentInstitutionLabel(paymentInstitution) ?? undefined,
      paymentInstitution,
    };
  }

  private parsePaymentMethod(value: string | undefined): PaymentMethod | undefined {
    const paymentMethod = this.parseKnownPaymentMethod(value);

    if (paymentMethod) {
      return paymentMethod;
    }

    if (this.normalize(value ?? "")) {
      throw new BadRequestException(`Meio de pagamento invalido: ${value}`);
    }

    return undefined;
  }

  private parseKnownPaymentMethod(value: string | undefined): PaymentMethod | undefined {
    const normalized = this.normalize(value ?? "");

    if (!normalized) {
      return undefined;
    }

    if (normalized.includes("debito")) {
      return PaymentMethod.DEBIT_CARD;
    }

    if (normalized.includes("credito")) {
      return PaymentMethod.CREDIT_CARD;
    }

    if (normalized.includes("voucher") || normalized.includes("vale")) {
      return PaymentMethod.VOUCHER;
    }

    if (normalized.includes("pix") || normalized.includes("saldo em conta")) {
      return PaymentMethod.PIX;
    }

    if (normalized.includes("dinheiro")) {
      return PaymentMethod.CASH;
    }

    return undefined;
  }

  private normalize(value: string): string {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  }

  private pickProduct(
    products: ProductCandidate[],
    row: ParsedImportRow,
    strategy: HistoricalOrderImportStrategy,
    fixedProductId: string | undefined
  ): ProductCandidate {
    if (strategy === "FIXED_PRODUCT") {
      const product = products.find((candidate) => candidate.id === fixedProductId);

      if (!product) {
        throw new BadRequestException("Produto fixo nao encontrado ou inativo");
      }

      return product;
    }

    const amount = row.amount.toNumber();
    const affordable = products.filter((product) => product.price.toNumber() <= amount + 0.01);
    const candidates = affordable.length > 0 ? affordable : products;
    const weighted = candidates.map((product) => {
      const distance = Math.abs(amount - product.price.toNumber());
      return {
        product,
        weight: 1 / Math.pow(1 + distance, 2),
      };
    });
    const totalWeight = weighted.reduce((total, item) => total + item.weight, 0);
    const random = this.deterministicRandom(row.importKey) * totalWeight;
    let cursor = 0;

    for (const item of weighted) {
      cursor += item.weight;

      if (random <= cursor) {
        return item.product;
      }
    }

    return weighted[weighted.length - 1].product;
  }

  private deterministicRandom(seed: string): number {
    const hex = createHash("sha256").update(seed).digest("hex").slice(0, 8);
    return parseInt(hex, 16) / 0xffffffff;
  }

  private externalImportKey(institution: PaymentInstitution, externalPaymentId: string): string {
    return createHash("sha256")
      .update(`${institution}|${externalPaymentId}`)
      .digest("hex")
      .slice(0, 16);
  }

  private buildImportNote(
    row: ParsedImportRow,
    product: ProductCandidate,
    strategy: HistoricalOrderImportStrategy,
    layout: string,
    payment: {
      paymentInstitution?: PaymentInstitution;
      paymentInstitutionName?: string | null;
      paymentMethod: PaymentMethod;
    }
  ): string {
    return [
      "Pedido importado de CSV historico",
      `importKey=${row.importKey}`,
      `linha=${row.rowNumber}`,
      `layout=${layout}`,
      `estrategia=${strategy}`,
      `descricao=${row.description || "sem descricao"}`,
      `idExterno=${row.externalPaymentId ?? "nao informado"}`,
      `taxa=${row.feeAmount?.toFixed(2) ?? "nao informada"}`,
      `liquido=${row.netAmount?.toFixed(2) ?? "nao informado"}`,
      `bandeira=${row.paymentBrand ?? "nao informada"}`,
      `liberacaoPrevista=${row.paymentReleaseExpectedAt?.toISOString() ?? "nao informada"}`,
      `origemLiberacao=${row.paymentReleaseSource ?? "nao informada"}`,
      `instituicaoPagamento=${payment.paymentInstitutionName ?? payment.paymentInstitution ?? "nao informada"}`,
      `meioPagamento=${payment.paymentMethod}`,
      `produtoReferencia=${product.name}`,
      `precoProduto=${product.price.toFixed(2)}`,
    ].join(" | ");
  }
}


function paymentInstitutionLabel(value: PaymentInstitution | null): string | null {
  if (!value) {
    return null;
  }

  return {
    PAGBANK: "PagBank",
    MERCADO_PAGO: "Mercado Pago",
    DINHEIRO: "Dinheiro",
    CAIXA_LOCAL: "Caixa Local",
  }[value];
}
