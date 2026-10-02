import { Inject, Injectable } from "@nestjs/common";
import { McpToolCallResult, Prisma } from "@prisma/client";
import { PrismaService } from "../../../platform/database/prisma.service";
import { localDayEnd, localDayStart } from "../../reports/sales-report.types";
import { McpUsageQueryDto } from "./dto/store-mcp.dto";

export interface McpUsageEntryView {
  id: string;
  occurredAt: string;
  tokenName: string | null;
  tokenPrefix: string | null;
  connectionId: string | null;
  clientName: string | null;
  userName: string | null;
  method: string;
  target: string | null;
  arguments: Prisma.JsonValue | null;
  result: McpToolCallResult;
  errorCode: string | null;
  durationMs: number;
}

export interface McpUsagePageView {
  page: number;
  pageSize: number;
  total: number;
  items: McpUsageEntryView[];
}

@Injectable()
export class McpUsageService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: McpUsageQueryDto = {}): Promise<McpUsagePageView> {
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 25) || 25));
    const occurredAt =
      query.start || query.end
        ? {
            gte: query.start ? localDayStart(query.start.slice(0, 10)) : undefined,
            lte: query.end ? localDayEnd(query.end.slice(0, 10)) : undefined,
          }
        : undefined;
    const where: Prisma.McpToolCallWhereInput = {
      tenantId,
      tokenId: query.tokenId,
      result: query.result,
      occurredAt,
    };

    const [rows, total] = await Promise.all([
      this.prisma.mcpToolCall.findMany({
        where,
        include: {
          token: { select: { name: true, tokenPrefix: true } },
          connection: { select: { client: { select: { name: true } }, user: { select: { name: true } } } },
        },
        orderBy: { occurredAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.mcpToolCall.count({ where }),
    ]);

    return {
      page,
      pageSize,
      total,
      items: rows.map((row) => ({
        id: row.id,
        occurredAt: row.occurredAt.toISOString(),
        tokenName: row.token?.name ?? null,
        tokenPrefix: row.token?.tokenPrefix ?? null,
        connectionId: row.connectionId ?? null,
        clientName: row.connection?.client.name ?? null,
        userName: row.connection?.user.name ?? null,
        method: row.method,
        target: row.target,
        arguments: row.arguments ?? null,
        result: row.result,
        errorCode: row.errorCode,
        durationMs: row.durationMs,
      })),
    };
  }
}
