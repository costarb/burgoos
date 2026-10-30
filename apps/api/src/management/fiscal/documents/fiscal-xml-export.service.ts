import { Inject, Injectable, UnprocessableEntityException } from "@nestjs/common";
import { FiscalEnvironment, Prisma } from "@prisma/client";
import { createZip, ZipEntry } from "../../../common/zip/zip-writer";
import { PrismaService } from "../../../platform/database/prisma.service";
import { FiscalAuditService } from "./fiscal-audit.service";
import { FiscalDocumentStorageService } from "./fiscal-document-storage.service";
import { FiscalDocumentsService } from "./fiscal-documents.service";

const MAX_DOCUMENTS = 5_000;
const ISSUED_STATUSES = ["AUTHORIZED", "CANCEL_PENDING", "CANCEL_FAILED", "CANCELLED"] as const;

export interface FiscalXmlExportQuery {
  from: string;
  to: string;
  environment?: FiscalEnvironment;
}

/**
 * ZIP for the accountant: `autorizadas/` (valid notes), `canceladas/` (authorization + cancellation
 * event) and `resumo.csv`. Production only by default; homologation notes never mix with real ones.
 */
@Injectable()
export class FiscalXmlExportService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FiscalDocumentStorageService) private readonly storage: FiscalDocumentStorageService,
    @Inject(FiscalDocumentsService) private readonly documents: FiscalDocumentsService,
    @Inject(FiscalAuditService) private readonly audit: FiscalAuditService
  ) {}

  async build(tenantId: string, query: FiscalXmlExportQuery): Promise<{ fileName: string; content: Buffer; count: number }> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(query.from) || !/^\d{4}-\d{2}-\d{2}$/.test(query.to) || query.from > query.to) {
      throw new UnprocessableEntityException({ code: "INVALID_PERIOD", message: "Informe um periodo valido" });
    }
    const environment = query.environment ?? "PRODUCTION";
    const where: Prisma.FiscalDocumentWhereInput = {
      tenantId,
      environment,
      status: { in: [...ISSUED_STATUSES] },
      accessKey: { not: null },
      saleOccurredAt: { gte: new Date(`${query.from}T00:00:00-03:00`), lte: new Date(`${query.to}T23:59:59.999-03:00`) },
    };
    const count = await this.prisma.fiscalDocument.count({ where });
    if (count > MAX_DOCUMENTS) {
      throw new UnprocessableEntityException({ code: "TOO_MANY_DOCUMENTS", message: `O periodo tem ${count} notas; exporte no maximo ${MAX_DOCUMENTS} por vez` });
    }
    const rows = await this.prisma.fiscalDocument.findMany({ where, orderBy: { saleOccurredAt: "asc" } });
    const entries: ZipEntry[] = [];
    const summary = ["numero;serie;chave;data_venda;valor;situacao;ambiente;xml"];

    for (const document of rows) {
      const cancelled = document.status === "CANCELLED";
      const folder = cancelled ? "canceladas" : "autorizadas";
      const key = document.accessKey as string;
      let xmlStatus = "ok";
      try {
        const xml = document.xmlAssetKey
          ? await this.storage.read(document.xmlAssetKey)
          : await this.documents.file(tenantId, document.id, "xml").then((file) => ("content" in file ? file.content : null));
        if (xml) entries.push({ name: `${folder}/${key}.xml`, content: xml });
        else xmlStatus = "indisponivel";
        if (cancelled && document.cancelXmlAssetKey) {
          entries.push({ name: `${folder}/${key}-cancelamento.xml`, content: await this.storage.read(document.cancelXmlAssetKey) });
        }
      } catch {
        xmlStatus = "indisponivel";
      }
      summary.push(
        [
          document.number ?? "",
          document.series ?? "",
          key,
          document.saleOccurredAt.toISOString(),
          new Prisma.Decimal(document.totalAmount).toFixed(2).replace(".", ","),
          document.status,
          document.environment,
          xmlStatus,
        ].join(";")
      );
    }

    entries.push({ name: "resumo.csv", content: Buffer.from(`﻿${summary.join("\r\n")}\r\n`, "utf8") });
    this.audit.log("fiscal.export.xml", { tenantId, from: query.from, to: query.to, environment, documents: rows.length });
    const suffix = environment === "HOMOLOGATION" ? "-homologacao" : "";
    return { fileName: `nfce-${query.from}-a-${query.to}${suffix}.zip`, content: createZip(entries), count: rows.length };
  }
}
