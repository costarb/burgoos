import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { AccessAuditEventType, AccessAuditResult, McpDataArea } from "@prisma/client";
import { AuthUser } from "../../../platform/auth/auth.types";
import { PrismaService } from "../../../platform/database/prisma.service";
import { AccessAuditService } from "../../access/access-audit.service";
import { ALL_MCP_DATA_AREAS, MCP_DATA_AREAS, normalizeAreas } from "../mcp-data-areas";
import { UpdateMcpConfigurationDto } from "./dto/store-mcp.dto";

export interface McpConfigurationView {
  enabled: boolean;
  enabledAreas: McpDataArea[];
  availableAreas: Array<{ area: McpDataArea; label: string; description: string; tools: string[] }>;
  serverUrl: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

@Injectable()
export class StoreMcpConfigurationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccessAuditService) private readonly audit: AccessAuditService
  ) {}

  async get(tenantId: string, serverUrl: string): Promise<McpConfigurationView> {
    const configuration = await this.prisma.storeMcpConfiguration.findUnique({
      where: { tenantId },
      include: { updatedByUser: { select: { name: true } } },
    });

    return {
      enabled: configuration?.enabled ?? false,
      enabledAreas: configuration ? normalizeAreas(configuration.enabledAreas) : [...ALL_MCP_DATA_AREAS],
      availableAreas: MCP_DATA_AREAS.map((definition) => ({
        area: definition.area,
        label: definition.label,
        description: definition.description,
        tools: [...definition.tools],
      })),
      serverUrl,
      updatedAt: configuration?.updatedAt.toISOString() ?? null,
      updatedBy: configuration?.updatedByUser?.name ?? null,
    };
  }

  async update(
    user: AuthUser,
    dto: UpdateMcpConfigurationDto,
    serverUrl: string
  ): Promise<McpConfigurationView> {
    const enabledAreas = normalizeAreas(dto.enabledAreas);
    if (dto.enabled && enabledAreas.length === 0) {
      throw new BadRequestException({
        code: "AREAS_REQUIRED",
        message: "Selecione ao menos uma area de dados para manter o MCP habilitado.",
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const before = await tx.storeMcpConfiguration.findUnique({
        where: { tenantId: user.tenantId },
        select: { enabled: true, enabledAreas: true },
      });

      await tx.storeMcpConfiguration.upsert({
        where: { tenantId: user.tenantId },
        create: {
          tenantId: user.tenantId,
          enabled: dto.enabled,
          enabledAreas,
          updatedByUserId: user.id,
        },
        update: { enabled: dto.enabled, enabledAreas, updatedByUserId: user.id },
      });

      await this.audit.record(
        {
          actorUserId: user.id,
          storeId: user.tenantId,
          eventType: AccessAuditEventType.MCP_CONFIGURATION_CHANGED,
          result: AccessAuditResult.SUCCESS,
          metadata: {
            before: before
              ? { enabled: before.enabled, enabledAreas: normalizeAreas(before.enabledAreas) }
              : { enabled: false, enabledAreas: [] },
            after: { enabled: dto.enabled, enabledAreas },
          },
        },
        tx
      );
    });

    return this.get(user.tenantId, serverUrl);
  }
}
