import { Inject, Injectable, Logger } from "@nestjs/common";
import { ExportFormat, ExportJobStatus, OperationalNotificationSeverity } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PrismaService } from "../../platform/database/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { ExportDataset, ExportProviderRegistry } from "./export-provider.registry";

const exportStorageRoot = join(process.cwd(), "tmp", "exports");

@Injectable()
export class ExportJobWorker {
  private readonly logger = new Logger(ExportJobWorker.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ExportProviderRegistry) private readonly providerRegistry: ExportProviderRegistry,
    @Inject(NotificationsService) private readonly notificationsService: NotificationsService
  ) {}

  async process(exportId: string): Promise<void> {
    const job = await this.prisma.exportJob.findUnique({ where: { id: exportId } });

    if (!job || job.status !== ExportJobStatus.PENDING) {
      return;
    }

    try {
      await this.prisma.exportJob.update({
        where: { id: job.id },
        data: { status: ExportJobStatus.PROCESSING, startedAt: new Date(), errorMessage: null },
      });

      const provider = this.providerRegistry.get(job.context);

      if (!provider) {
        throw new Error("Contexto de exportacao nao suportado");
      }

      const dataset = await provider.build(job);
      const file = renderExportFile(dataset, job.format);
      const storageKey = `${job.tenantId}/${job.id}/${file.fileName}`;
      const absolutePath = join(exportStorageRoot, storageKey);

      await mkdir(join(exportStorageRoot, job.tenantId, job.id), { recursive: true });
      await writeFile(absolutePath, file.content);

      await this.prisma.exportJob.update({
        where: { id: job.id },
        data: {
          status: ExportJobStatus.COMPLETED,
          completedAt: new Date(),
          fileName: file.fileName,
          fileMimeType: file.mimeType,
          fileStorageKey: storageKey,
          fileSizeBytes: file.content.byteLength,
          expiresAt: addDays(new Date(), 7),
        },
      });

      await this.notificationsService.create({
        tenantId: job.tenantId,
        recipientUserId: job.requestedByUserId,
        type: "PAYABLE_EXPORT_COMPLETED",
        severity: OperationalNotificationSeverity.SUCCESS,
        title: "Exportacao concluida",
        message: `O arquivo ${file.fileName} esta pronto para download.`,
        actionLabel: "Baixar arquivo",
        actionUrl: `/api/admin/exports/${job.id}/download`,
        relatedEntityType: "export_job",
        relatedEntityId: job.id,
        exportJobId: job.id,
      });
    } catch (error) {
      const message = "Nao foi possivel gerar a exportacao.";

      await this.prisma.exportJob.update({
        where: { id: job.id },
        data: {
          status: ExportJobStatus.FAILED,
          failedAt: new Date(),
          errorMessage: message,
        },
      });

      await this.notificationsService.create({
        tenantId: job.tenantId,
        recipientUserId: job.requestedByUserId,
        type: "PAYABLE_EXPORT_FAILED",
        severity: OperationalNotificationSeverity.ERROR,
        title: "Exportacao nao concluida",
        message,
        relatedEntityType: "export_job",
        relatedEntityId: job.id,
        exportJobId: job.id,
      });

      this.logger.error(
        `Export job ${job.id} failed`,
        error instanceof Error ? error.stack : undefined
      );
    }
  }
}

interface RenderedExportFile {
  fileName: string;
  mimeType: string;
  content: Buffer;
}

function renderExportFile(dataset: ExportDataset, format: ExportFormat): RenderedExportFile {
  const baseName = slugify(dataset.title);

  if (format === ExportFormat.CSV) {
    return {
      fileName: `${baseName}.csv`,
      mimeType: "text/csv; charset=utf-8",
      content: Buffer.from(renderCsv(dataset), "utf8"),
    };
  }

  if (format === ExportFormat.PDF) {
    return {
      fileName: `${baseName}.pdf`,
      mimeType: "application/pdf",
      content: renderPdf(dataset),
    };
  }

  return {
    fileName: `${baseName}.xlsx`,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    content: renderXlsx(dataset),
  };
}

function renderCsv(dataset: ExportDataset): string {
  const lines = [
    dataset.columns.map((column) => csvCell(column.label)).join(","),
    ...dataset.rows.map((row) =>
      dataset.columns.map((column) => csvCell(row[column.key] ?? "")).join(",")
    ),
  ];

  return `${lines.join("\r\n")}\r\n`;
}

function csvCell(value: string | number | null): string {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function renderPdf(dataset: ExportDataset): Buffer {
  const page = { width: 595, height: 842, margin: 42 };
  const availableWidth = page.width - page.margin * 2;
  const visibleColumns = dataset.columns.slice(0, 6);
  const columnWidth = availableWidth / Math.max(visibleColumns.length, 1);
  const rowHeight = 18;
  const headerY = 740;
  const maxRows = Math.max(Math.floor((headerY - page.margin) / rowHeight) - 2, 1);
  const tableHeight = 24 + rowHeight * Math.min(dataset.rows.length, maxRows);
  const stream: string[] = [
    "0.96 0.97 0.98 rg",
    `${page.margin} ${headerY - 6} ${availableWidth} 24 re f`,
    "0.86 0.89 0.93 RG",
    `${page.margin} ${headerY - tableHeight + 18} ${availableWidth} ${tableHeight} re S`,
  ];

  stream.push(...pdfTextAt(dataset.title, page.margin, 794, 16));
  stream.push(...pdfTextAt(`Gerado em ${formatPdfDate(new Date())}`, page.margin, 774, 9));

  visibleColumns.forEach((column, index) => {
    stream.push(
      ...pdfTextAt(
        truncatePdfText(column.label, Math.floor(columnWidth / 5.8)),
        page.margin + index * columnWidth + 6,
        headerY,
        9
      )
    );
  });

  dataset.rows.slice(0, maxRows).forEach((row, rowIndex) => {
    const y = headerY - 22 - rowIndex * rowHeight;

    stream.push("0.90 0.92 0.95 RG", `${page.margin} ${y - 5} ${availableWidth} 0.5 re f`);

    visibleColumns.forEach((column, columnIndex) => {
      stream.push(
        ...pdfTextAt(
          truncatePdfText(String(row[column.key] ?? ""), Math.floor(columnWidth / 5.8)),
          page.margin + columnIndex * columnWidth + 6,
          y,
          8
        )
      );
    });
  });

  if (dataset.rows.length > maxRows) {
    stream.push(
      ...pdfTextAt(
        `Exibindo ${maxRows} de ${dataset.rows.length} registros neste arquivo.`,
        page.margin,
        page.margin,
        8
      )
    );
  }

  return buildPdf(stream.join("\n"));
}

function pdfTextAt(value: string, x: number, y: number, size: number): string[] {
  return ["0 0 0 rg", "BT", `/F1 ${size} Tf`, `${x} ${y} Td`, `(${escapePdfText(value)}) Tj`, "ET"];
}

function truncatePdfText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(maxLength - 1, 1))}.`;
}

function formatPdfDate(value: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(value);
}

function buildPdf(contentStream: string): Buffer {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(contentStream, "utf8")} >>\nstream\n${contentStream}\nendstream`,
  ];
  const chunks = ["%PDF-1.4\n"];
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(chunks.join(""), "utf8"));
    chunks.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  });

  const xrefOffset = Buffer.byteLength(chunks.join(""), "utf8");
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  offsets.slice(1).forEach((offset) => {
    chunks.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  });
  chunks.push(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  );

  return Buffer.from(chunks.join(""), "utf8");
}

function escapePdfText(value: string): string {
  return value.replace(/[\\()]/g, (character) => `\\${character}`);
}

function renderXlsx(dataset: ExportDataset): Buffer {
  const worksheetRows = [
    dataset.columns.map((column) => column.label),
    ...dataset.rows.map((row) => dataset.columns.map((column) => row[column.key] ?? "")),
  ];
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
${worksheetRows.map((row, rowIndex) => renderXlsxRow(row, rowIndex + 1)).join("\n")}
  </sheetData>
</worksheet>`;

  return createZip([
    {
      name: "[Content_Types].xml",
      content: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`),
    },
    {
      name: "_rels/.rels",
      content: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    },
    {
      name: "xl/workbook.xml",
      content: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Exportacao" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`),
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`),
    },
    { name: "xl/worksheets/sheet1.xml", content: Buffer.from(sheet) },
  ]);
}

function renderXlsxRow(row: Array<string | number | null>, rowNumber: number): string {
  const cells = row
    .map((value, columnIndex) => {
      const reference = `${columnName(columnIndex + 1)}${rowNumber}`;
      return `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(String(value ?? ""))}</t></is></c>`;
    })
    .join("");

  return `    <row r="${rowNumber}">${cells}</row>`;
}

function columnName(index: number): string {
  let value = index;
  let name = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }

  return name;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface ZipEntry {
  name: string;
  content: Buffer;
}

function createZip(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  entries.forEach((entry) => {
    const name = Buffer.from(entry.name);
    const crc = crc32(entry.content);
    const local = Buffer.alloc(30);

    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(entry.content.length, 18);
    local.writeUInt32LE(entry.content.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, entry.content);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(entry.content.length, 20);
    central.writeUInt32LE(entry.content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);

    offset += local.length + name.length + entry.content.length;
  });

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const end = Buffer.alloc(22);

  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, end]);
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}
