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
  paymentMethod: PaymentMethod;
  externalPaymentId: string | null;
  grossAmount: string;
  feeAmount: string | null;
  netAmount: string | null;
  paymentReleaseExpectedAt: string | null;
  paymentReleaseSource: PaymentReleaseSource | null;
}

interface SkippedOrderResult {
  rowNumber: number;
  reason: string;
}

@Injectable()
export class HistoricalOrderImportService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OrderProfitabilityService)
    private readonly orderProfitabilityService: OrderProfitabilityService
  ) {}

  async importFromCsv(tenantId: string, dto: ImportOrdersDto) {
    const strategy = dto.strategy ?? "PRICE_WEIGHTED";
    const layout = dto.layout ?? "SIMPLE";
    const rows = this.parseCsv(dto.csvText, layout);

    if (rows.length === 0) {
      throw new BadRequestException("Nenhuma venda valida encontrada no CSV");
    }

    const [products, existingKeys, orderPlatform] = await Promise.all([
      this.getProductCandidates(tenantId, dto.fixedProductId, strategy),
      this.findExistingRows(
        tenantId,
        rows.map((row) => ({
          importKey: row.importKey,
          externalPaymentId: row.externalPaymentId,
        }))
      ),
      this.upsertOrderPlatform(tenantId, dto.orderPlatformName ?? "FOOD_TRUCK"),
    ]);

    const imported: ImportedOrderResult[] = [];
    const skipped: SkippedOrderResult[] = [];

    for (const row of rows) {
      if (existingKeys.has(row.importKey)) {
        skipped.push({ rowNumber: row.rowNumber, reason: "Linha ja importada" });
        continue;
      }

      const product = this.pickProduct(products, row, strategy, dto.fixedProductId);
      const order = await this.prisma.order.create({
        data: {
          tenantId,
          status: OrderStatus.DELIVERED,
          total: row.amount,
          customerName: "Cliente importado",
          customerPhone: "00000000000",
          fulfillmentMethod: FulfillmentMethod.PICKUP,
          paymentMethod: row.paymentMethod ?? dto.paymentMethod ?? PaymentMethod.PIX_MANUAL,
          paymentInstitution: row.paymentInstitution ?? dto.paymentInstitution,
          externalPaymentId: row.externalPaymentId,
          paymentGrossAmount: row.amount,
          paymentFeeAmount: row.feeAmount,
          paymentNetAmount: row.netAmount,
          paymentBrand: row.paymentBrand,
          paymentReleaseExpectedAt: row.paymentReleaseExpectedAt,
          paymentReleaseSource: row.paymentReleaseSource,
          orderPlatformId: orderPlatform.id,
          notes: this.buildImportNote(row, product, strategy, layout, {
            paymentInstitution: row.paymentInstitution ?? dto.paymentInstitution,
            paymentMethod: row.paymentMethod ?? dto.paymentMethod ?? PaymentMethod.PIX_MANUAL,
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

      await this.orderProfitabilityService.createDeliveredOrderSnapshots(tenantId, order.id);
      existingKeys.add(row.importKey);

      imported.push({
        rowNumber: row.rowNumber,
        orderId: order.id,
        date: row.date.toISOString(),
        amount: row.amount.toFixed(2),
        productId: product.id,
        productName: product.name,
        paymentInstitution: row.paymentInstitution ?? dto.paymentInstitution ?? null,
        paymentMethod: row.paymentMethod ?? dto.paymentMethod ?? PaymentMethod.PIX_MANUAL,
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
        const row = rows.find((candidate) => candidate.externalPaymentId === order.externalPaymentId);

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

  private parseCsv(csvText: string, layout: HistoricalOrderImportLayout): ParsedImportRow[] {
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
      .map((line, index) => this.parseLine(line, index + 2, header, layout))
      .filter((row): row is ParsedImportRow => Boolean(row));
  }

  private parseLine(
    line: string,
    rowNumber: number,
    header: Map<string, number>,
    layout: HistoricalOrderImportLayout
  ): ParsedImportRow | null {
    const columns = line.split(";");

    if (layout === "MERCADO_PAGO") {
      return this.parseMercadoPagoLine(columns, header, rowNumber);
    }

    if (layout === "PAGBANK") {
      return this.parsePagBankLine(columns, header, rowNumber);
    }

    return this.parseSimpleLine(columns, header, rowNumber);
  }

  private parseSimpleLine(
    columns: string[],
    header: Map<string, number>,
    rowNumber: number
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

    const paymentInstitution = this.parsePaymentInstitution(
      this.column(columns, header, "instituicao") ??
        this.column(columns, header, "instituicao de pagamento")
    );
    const paymentMethod = this.parsePaymentMethod(
      this.column(columns, header, "meio") ??
        this.column(columns, header, "meio de pagamento") ??
        this.column(columns, header, "pagamento")
    );
    const date = this.parseDate(dateText, rowNumber);
    const effectiveDate = this.withImportTime(date, rowNumber);
    const paymentRelease = this.resolvePaymentRelease(effectiveDate, undefined, {
      paymentInstitution,
      paymentMethod,
    });
    const importKey = createHash("sha256")
      .update(
        `${rowNumber}|${dateText}|${description}|${amount.toFixed(2)}|${paymentInstitution ?? ""}|${
          paymentMethod ?? ""
        }`
      )
      .digest("hex")
      .slice(0, 16);

    return {
      rowNumber,
      date: effectiveDate,
      description: description.trim(),
      amount,
      paymentInstitution,
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
    const net = this.parseRequiredDecimal(this.requiredColumn(columns, header, "NET", rowNumber), rowNumber);
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
    const externalPaymentId = this.requiredColumn(columns, header, "Código da Transação", rowNumber);
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
      throw new BadRequestException(`Coluna obrigatoria ausente ou vazia: ${name} na linha ${rowNumber}`);
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
    const withSlash = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
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

  private parsePaymentInstitution(value: string | undefined): PaymentInstitution | undefined {
    const normalized = this.normalize(value ?? "");

    if (!normalized) {
      return undefined;
    }

    if (normalized.includes("pagbank") || normalized.includes("pagseguro")) {
      return PaymentInstitution.PAGBANK;
    }

    if (normalized.includes("mercado")) {
      return PaymentInstitution.MERCADO_PAGO;
    }

    if (normalized.includes("dinheiro")) {
      return PaymentInstitution.DINHEIRO;
    }

    if (normalized.includes("caixa")) {
      return PaymentInstitution.CAIXA_LOCAL;
    }

    throw new BadRequestException(`Instituicao de pagamento invalida: ${value}`);
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
    layout: HistoricalOrderImportLayout,
    payment: {
      paymentInstitution?: PaymentInstitution;
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
      `instituicaoPagamento=${payment.paymentInstitution ?? "nao informada"}`,
      `meioPagamento=${payment.paymentMethod}`,
      `produtoReferencia=${product.name}`,
      `precoProduto=${product.price.toFixed(2)}`,
    ].join(" | ");
  }
}
