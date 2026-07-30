import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { IdempotencyStatus, Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../../platform/database/prisma.service";

export const IDEMPOTENCY_CONFLICT = "IDEMPOTENCY_CONFLICT";

export type IdempotencyClaim =
  | { kind: "claimed"; recordId: string }
  | { kind: "replay"; statusCode: number; body: unknown };

@Injectable()
export class IdempotencyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  hashRequest(payload: unknown): string {
    return createHash("sha256").update(stableJson(payload)).digest("hex");
  }

  async claim(input: {
    tenantId: string;
    scope: string;
    key: string;
    request: unknown;
    ttlMs?: number;
  }): Promise<IdempotencyClaim> {
    const requestHash = this.hashRequest(input.request);
    const expiresAt = new Date(Date.now() + (input.ttlMs ?? 24 * 60 * 60 * 1000));

    try {
      const record = await this.prisma.idempotencyRecord.create({
        data: {
          tenantId: input.tenantId,
          scope: input.scope,
          key: input.key,
          requestHash,
          expiresAt,
        },
      });
      return { kind: "claimed", recordId: record.id };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }
    }

    const existing = await this.prisma.idempotencyRecord.findUniqueOrThrow({
      where: {
        tenantId_scope_key: {
          tenantId: input.tenantId,
          scope: input.scope,
          key: input.key,
        },
      },
    });

    if (existing.requestHash !== requestHash) {
      throw this.conflict("A chave de idempotencia ja foi usada com outro conteudo");
    }

    if (existing.status === IdempotencyStatus.COMPLETED) {
      return {
        kind: "replay",
        statusCode: existing.responseCode ?? 200,
        body: existing.responseBody,
      };
    }

    if (existing.status === IdempotencyStatus.PENDING && existing.expiresAt > new Date()) {
      throw this.conflict("Uma requisicao com esta chave ainda esta em processamento");
    }

    const reclaimed = await this.prisma.idempotencyRecord.updateMany({
      where: {
        id: existing.id,
        OR: [{ status: IdempotencyStatus.FAILED }, { expiresAt: { lte: new Date() } }],
      },
      data: {
        requestHash,
        status: IdempotencyStatus.PENDING,
        responseCode: null,
        responseBody: Prisma.JsonNull,
        expiresAt,
      },
    });

    if (reclaimed.count !== 1) {
      throw this.conflict("Uma requisicao com esta chave ainda esta em processamento");
    }

    return { kind: "claimed", recordId: existing.id };
  }

  async complete(recordId: string, statusCode: number, body: unknown): Promise<void> {
    await this.prisma.idempotencyRecord.update({
      where: { id: recordId },
      data: {
        status: IdempotencyStatus.COMPLETED,
        responseCode: statusCode,
        responseBody: toJson(body),
      },
    });
  }

  async fail(recordId: string): Promise<void> {
    await this.prisma.idempotencyRecord.updateMany({
      where: { id: recordId, status: IdempotencyStatus.PENDING },
      data: { status: IdempotencyStatus.FAILED },
    });
  }

  private conflict(message: string): ConflictException {
    return new ConflictException({ statusCode: 409, code: IDEMPOTENCY_CONFLICT, message });
  }
}

function stableJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
    .join(",")}}`;
}

function toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
