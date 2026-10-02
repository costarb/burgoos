import { McpDataArea } from "@prisma/client";
import { z } from "zod";

export interface McpPromptDefinition {
  name: string;
  title: string;
  description: string;
  areas: McpDataArea[];
  argsSchema: z.ZodRawShape;
  build: (args: Record<string, string | undefined>) => string;
}

const date = (description: string) => z.string().describe(`${description} (AAAA-MM-DD)`);

const COMMON_RULES =
  "Use apenas os numeros retornados pelas ferramentas do RRFive OS; nao invente valores. Cite o periodo usado. Responda em portugues, com secoes curtas e uma lista final de acoes recomendadas.";

export const ANALYSIS_PROMPTS: McpPromptDefinition[] = [
  {
    name: "analise_semanal",
    title: "Analise semanal da loja",
    description: "Compara a semana com a anterior e aponta destaques e pontos de atencao.",
    areas: [McpDataArea.SALES],
    argsSchema: {
      semanaTerminandoEm: date("Ultimo dia da semana analisada; vazio = hoje").optional(),
    },
    build: (args) =>
      [
        `Faca uma analise semanal da loja para a semana de 7 dias terminando em ${args.semanaTerminandoEm ?? "hoje"}.`,
        "1. Chame resumo_vendas para essa semana e para os 7 dias anteriores.",
        "2. Compare faturamento bruto, receita liquida, pedidos e ticket medio (variacao absoluta e percentual).",
        "3. Compare a participacao de cada plataforma e meio de pagamento e o desempenho por dia da semana.",
        "4. Liste 3 destaques positivos e 3 pontos de atencao.",
        COMMON_RULES,
      ].join("\n"),
  },
  {
    name: "comparar_periodos",
    title: "Comparar dois periodos",
    description: "Compara vendas e DRE entre dois periodos e explica as causas provaveis.",
    areas: [McpDataArea.SALES, McpDataArea.FINANCIAL],
    argsSchema: {
      inicioA: date("Inicio do periodo A"),
      fimA: date("Fim do periodo A"),
      inicioB: date("Inicio do periodo B"),
      fimB: date("Fim do periodo B"),
    },
    build: (args) =>
      [
        `Compare o periodo A (${args.inicioA} a ${args.fimA}) com o periodo B (${args.inicioB} a ${args.fimB}).`,
        "1. Chame resumo_vendas e dre para cada periodo.",
        "2. Monte uma tabela com faturamento, receita liquida, pedidos, ticket medio, CMV, margem de contribuicao e lucro liquido estimado, com variacao absoluta e percentual.",
        "3. Explique as causas provaveis das maiores variacoes (mix de plataformas, ticket, custos).",
        COMMON_RULES,
      ].join("\n"),
  },
  {
    name: "diagnostico_margem_cardapio",
    title: "Diagnostico de margem do cardapio",
    description: "Sugere acoes por produto a partir da engenharia de cardapio.",
    areas: [McpDataArea.MENU],
    argsSchema: {
      inicio: date("Inicio do periodo; vazio = mes corrente").optional(),
      fim: date("Fim do periodo; vazio = mes corrente").optional(),
    },
    build: (args) =>
      [
        `Faca um diagnostico de margem do cardapio${args.inicio ? ` de ${args.inicio} a ${args.fim ?? args.inicio}` : " do mes corrente"}.`,
        "1. Chame engenharia_cardapio para o periodo.",
        "2. Agrupe os produtos por classificacao (STAR, WORKHORSE, PUZZLE, DOG) e explique o que cada grupo significa (veja o recurso glossario_metricas).",
        "3. Sugira acoes concretas: reprecificar, revisar ficha tecnica, promover, reposicionar ou retirar.",
        "4. Estime o impacto de aumentar em 5% o preco dos WORKHORSE de maior volume.",
        COMMON_RULES,
      ].join("\n"),
  },
  {
    name: "saude_caixa_30_dias",
    title: "Saude do caixa nos proximos 30 dias",
    description: "Cruza a projecao de caixa com as contas a vencer e aponta dias de risco.",
    areas: [McpDataArea.CASH, McpDataArea.PAYABLES],
    argsSchema: {},
    build: () =>
      [
        "Avalie a saude do caixa da loja nos proximos 30 dias.",
        "1. Chame posicao_caixa (padrao: hoje + 30 dias) e contas_a_pagar com status OPEN, PARTIALLY_PAID e OVERDUE para o mesmo intervalo.",
        "2. Aponte os dias com saldo projetado mais baixo ou negativo e as contas que mais pesam nesses dias.",
        "3. Destaque contas vencidas e sugira prioridades de pagamento ou renegociacao.",
        COMMON_RULES,
      ].join("\n"),
  },
];
