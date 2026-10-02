import { Inject, Injectable } from "@nestjs/common";
import { McpDataArea } from "@prisma/client";
import { z } from "zod";
import { InventoryService } from "../../../operations/inventory/inventory.service";
import { McpToolDefinition, stringArray, truncate } from "./tool-output";

const SITUATIONS = ["OK", "BUY", "INSUFFICIENT"] as const;
const SEVERITY: Record<string, number> = { INSUFFICIENT: 0, BUY: 1, OK: 2 };

type Balances = Awaited<ReturnType<InventoryService["listBalances"]>>;

@Injectable()
export class InventoryTools {
  constructor(@Inject(InventoryService) private readonly inventory: InventoryService) {}

  definitions(): McpToolDefinition[] {
    return [
      {
        name: "estoque",
        area: McpDataArea.INVENTORY,
        title: "Posicao de estoque",
        description:
          "Posicao atual de estoque dos ingredientes: saldo estimado, estoque minimo e situacao (OK, BUY = comprar, INSUFFICIENT = insuficiente). Retorna ate 50 itens, criticos primeiro.",
        inputSchema: {
          situacao: z.array(z.enum(SITUATIONS)).optional().describe("Filtra por situacao."),
        },
        handler: async (context, args) =>
          mapInventory(await this.inventory.listBalances(context.tenantId), stringArray(args.situacao)),
      },
    ];
  }
}

export function mapInventory(balances: Balances, situations: string[]) {
  const filter = new Set(situations);
  const items = balances
    .filter((item) => filter.size === 0 || filter.has(item.status))
    .sort(
      (left, right) =>
        SEVERITY[left.status] - SEVERITY[right.status] ||
        left.ingredientName.localeCompare(right.ingredientName)
    )
    .map((item) => ({
      ingrediente: item.ingredientName,
      saldoEstimado: item.estimatedBalance,
      estoqueMinimo: item.minimumStock,
      consumidoOuReservado: item.reservedOrConsumed,
      situacao: item.status,
    }));
  const page = truncate(items);

  return {
    totais: {
      ingredientes: balances.length,
      ok: balances.filter((item) => item.status === "OK").length,
      comprar: balances.filter((item) => item.status === "BUY").length,
      insuficiente: balances.filter((item) => item.status === "INSUFFICIENT").length,
    },
    itens: page.items,
    totalItens: page.totalItens,
    truncado: page.truncado,
    semMovimento: balances.length === 0,
  };
}
