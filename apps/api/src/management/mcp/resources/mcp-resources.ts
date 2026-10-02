import { Inject, Injectable } from "@nestjs/common";
import { PaymentInstitution, PaymentMethod } from "@prisma/client";
import { PrismaService } from "../../../platform/database/prisma.service";
import { areaLabel } from "../mcp-data-areas";
import { McpRequestContext } from "../server/mcp-context";
import { BUSINESS_TIME_ZONE } from "../tools/tool-output";
import { METRICS_GLOSSARY } from "./metrics-glossary";

export interface McpResourceDefinition {
  name: string;
  uri: string;
  title: string;
  description: string;
  mimeType: string;
  read: (context: McpRequestContext) => Promise<string>;
}

@Injectable()
export class McpResources {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  definitions(): McpResourceDefinition[] {
    return [
      {
        name: "perfil_loja",
        uri: "rrfive://loja/perfil",
        title: "Perfil da loja",
        description:
          "Nome da loja, fuso horario, plataformas de venda (com ids para filtros), meios de pagamento, instituicoes e areas de dados liberadas.",
        mimeType: "application/json",
        read: async (context) => JSON.stringify(await this.storeProfile(context), null, 2),
      },
      {
        name: "glossario_metricas",
        uri: "rrfive://glossario",
        title: "Glossario de metricas",
        description:
          "Definicoes das metricas usadas pelas ferramentas (faturamento, ticket medio, CMV, margem de contribuicao, engenharia de cardapio, situacoes de contas e estoque) e regras de periodo.",
        mimeType: "text/markdown",
        read: async () => METRICS_GLOSSARY,
      },
    ];
  }

  private async storeProfile(context: McpRequestContext) {
    const platforms = await this.prisma.orderPlatform.findMany({
      where: { tenantId: context.tenantId, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return {
      nome: context.storeName,
      slug: context.storeSlug,
      fuso: BUSINESS_TIME_ZONE,
      moeda: "BRL",
      plataformas: platforms.map((platform) => ({ id: platform.id, nome: platform.name })),
      meiosPagamento: Object.values(PaymentMethod),
      instituicoes: Object.values(PaymentInstitution),
      areasLiberadas: context.enabledAreas.map((area) => ({ area, rotulo: areaLabel(area) })),
    };
  }
}
