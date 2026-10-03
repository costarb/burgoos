import { McpDataArea, UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { AccountsPayableService } from "../src/management/financial/accounts-payable/accounts-payable.service";
import { FinancialAuditService } from "../src/management/financial/financial-audit.service";
import { McpRequestContext } from "../src/management/mcp/server/mcp-context";
import { PayablesActionsTools } from "../src/management/mcp/tools/payables-actions.tools";
import type { AuthUser } from "../src/platform/auth/auth.types";
import { createPayablesFakePrisma } from "./support/payables-fake-prisma";

const TENANT = "11111111-1111-4111-8111-111111111111";
const USER_ID = "aaaaaaaa-0000-4000-8000-000000000001";

const context: McpRequestContext = {
  tenantId: TENANT,
  tokenId: null,
  connectionId: "connection-1",
  userId: USER_ID,
  clientName: "Claude",
  enabledAreas: Object.values(McpDataArea),
  storeName: "Loja",
  storeSlug: "loja",
  actions: { allowed: true, elevated: true, permissions: [], channel: "MCP · Claude" },
};

describe("MCP payables actions (SC-002)", () => {
  let prisma: ReturnType<typeof createPayablesFakePrisma>;
  let service: AccountsPayableService;
  let tools: Record<string, (args: Record<string, unknown>) => Promise<Record<string, unknown>>>;

  beforeEach(() => {
    prisma = createPayablesFakePrisma(TENANT);
    service = new AccountsPayableService(
      prisma as never,
      new FinancialAuditService(prisma as never)
    );
    tools = Object.fromEntries(
      new PayablesActionsTools(service)
        .definitions()
        .map((tool) => [tool.name, (args: Record<string, unknown>) => tool.handler(context, args)])
    );
  });

  it("creates a recurring payable exactly like the screen, audited with the MCP origin", async () => {
    const result = await tools.criar_conta_a_pagar({
      descricao: "Aluguel loja",
      valorReais: 3000,
      vencimento: "2026-11-10",
      categoria: "aluguel",
      fornecedor: "imobiliaria centro",
      competencia: "2026-11",
      recorrencia: { frequencia: "MONTHLY", intervalo: 1, quantidade: 3 },
    });

    expect(result).toMatchObject({ criadas: 3 });
    expect((result.contas as Array<Record<string, unknown>>)[0]).toMatchObject({
      descricao: "Aluguel loja (1/3)",
      categoria: "Aluguel",
      fornecedor: "Imobiliária Centro",
      competencia: "2026-11-01",
      vencimento: "2026-11-10",
      valorReais: 3000,
      classificacaoDre: "FIXED_COST",
      classificacaoAjustada: false,
    });

    const screenPrisma = createPayablesFakePrisma(TENANT);
    const screen = new AccountsPayableService(
      screenPrisma as never,
      new FinancialAuditService(screenPrisma as never)
    );
    const screenUser: AuthUser = {
      id: USER_ID,
      tenantId: TENANT,
      role: UserRole.OWNER,
      email: "",
      name: "",
    };
    await screen.create(screenUser, {
      categoryId: "cat-rent",
      supplierId: "sup-1",
      description: "Aluguel loja",
      competenceDate: "2026-11-01",
      dueDate: "2026-11-10",
      expectedAmount: 3000,
      recurrence: { frequency: "MONTHLY", interval: 1, startsOn: "2026-11-10", occurrenceCount: 3 },
    });
    const strip = (rows: Array<Record<string, unknown>>) =>
      rows.map(({ id: _id, createdAt: _createdAt, ...rest }) => rest);
    expect(strip(prisma.state.payables)).toEqual(strip(screenPrisma.state.payables));

    expect(prisma.state.audits).toHaveLength(3);
    expect(prisma.state.audits.every((audit) => audit.channel === "MCP · Claude")).toBe(true);
    expect(prisma.state.audits[0]).toMatchObject({
      actorUserId: USER_ID,
      tenantId: TENANT,
      action: "CREATE",
    });
    expect(screenPrisma.state.audits.every((audit) => audit.channel === undefined)).toBe(true);
  });

  it("refuses unknown or ambiguous names listing the options", async () => {
    await expect(
      tools.criar_conta_a_pagar({
        descricao: "X",
        valorReais: 10,
        vencimento: "2026-11-10",
        categoria: "Marketing",
      })
    ).rejects.toThrow(
      "Categoria nao encontrada: Marketing. Opcoes: Aluguel, Prestador de Serviço."
    );

    prisma.state.categories.push({ ...prisma.state.categories[0], id: "cat-rent-2" });
    await expect(
      tools.criar_conta_a_pagar({
        descricao: "X",
        valorReais: 10,
        vencimento: "2026-11-10",
        categoria: "Aluguel",
      })
    ).rejects.toThrow("Mais de um(a) categoria");
  });

  it("detects a probable duplicate and only creates it with explicit confirmation", async () => {
    const args = {
      descricao: "Energia",
      valorReais: 450.5,
      vencimento: "2026-11-05",
      categoria: "Prestador de Servico",
    };
    await tools.criar_conta_a_pagar(args);

    const again = await tools.criar_conta_a_pagar({ ...args, descricao: "energia " });
    expect(again).toMatchObject({ duplicidade: true, contaExistente: { descricao: "Energia" } });
    expect(prisma.state.payables).toHaveLength(1);

    await tools.criar_conta_a_pagar({ ...args, confirmarDuplicidade: true });
    expect(prisma.state.payables).toHaveLength(2);
  });

  it("requires an end or a count for recurrences", async () => {
    await expect(
      tools.criar_conta_a_pagar({
        descricao: "Internet",
        valorReais: 100,
        vencimento: "2026-11-05",
        categoria: "Aluguel",
        recorrencia: { frequencia: "MONTHLY", intervalo: 1 },
      })
    ).rejects.toThrow("informe o fim ou a quantidade");
  });

  it("registers partial and total payments and refuses exceeding the remaining amount", async () => {
    const created = await tools.criar_conta_a_pagar({
      descricao: "Contador",
      valorReais: 800,
      vencimento: "2026-11-10",
      categoria: "Prestador de Servico",
    });
    const id = (created.contas as Array<{ id: string }>)[0].id;

    const partial = await tools.registrar_pagamento_conta({
      contaId: id,
      valorReais: 300,
      dataPagamento: "2026-11-08",
      contaFinanceira: "banco inter",
    });
    expect(partial).toMatchObject({
      conta: { pagoReais: 300, restanteReais: 500, status: "PARTIALLY_PAID" },
    });

    await expect(
      tools.registrar_pagamento_conta({
        contaId: id,
        valorReais: 600,
        dataPagamento: "2026-11-09",
        contaFinanceira: "acc-1",
      })
    ).rejects.toThrow("Pagamento excede o saldo em aberto");

    const total = await tools.registrar_pagamento_conta({
      contaId: id,
      valorReais: 500,
      dataPagamento: "2026-11-10",
      contaFinanceira: "acc-1",
    });
    expect(total).toMatchObject({ conta: { restanteReais: 0, status: "PAID" } });
    expect(prisma.state.payments[0]).toMatchObject({
      createdByUserId: USER_ID,
      financialAccountId: "acc-1",
    });
    expect(prisma.state.audits.filter((audit) => audit.action === "PAY")).toHaveLength(2);
  });

  it("edits only the given fields and keeps the rest", async () => {
    const created = await tools.criar_conta_a_pagar({
      descricao: "Manutencao",
      valorReais: 200,
      vencimento: "2026-11-10",
      categoria: "Prestador de Servico",
      fornecedor: "Imobiliaria Centro",
      competencia: "2026-11-01",
      documento: "NF 10",
    });
    const id = (created.contas as Array<{ id: string }>)[0].id;

    const edited = await tools.editar_conta_a_pagar({
      contaId: id,
      valorReais: 250,
      classificacaoDre: "FIXED_COST",
    });
    expect(edited).toMatchObject({
      antes: { valorReais: 200, classificacaoDre: "VARIABLE_EXPENSE" },
      depois: {
        valorReais: 250,
        descricao: "Manutencao",
        fornecedor: "Imobiliária Centro",
        competencia: "2026-11-01",
        vencimento: "2026-11-10",
        classificacaoDre: "FIXED_COST",
        classificacaoAjustada: true,
      },
    });
    expect(prisma.state.payables[0].documentReference).toBe("NF 10");

    const cleared = await tools.editar_conta_a_pagar({
      contaId: id,
      fornecedor: null,
      classificacaoDre: null,
    });
    expect(cleared).toMatchObject({ depois: { fornecedor: null, classificacaoAjustada: false } });
  });

  it("cancels with a reason and refuses payables with payments", async () => {
    const first = await tools.criar_conta_a_pagar({
      descricao: "Evento",
      valorReais: 100,
      vencimento: "2026-11-10",
      categoria: "Aluguel",
    });
    const id = (first.contas as Array<{ id: string }>)[0].id;
    const cancelled = await tools.cancelar_conta_a_pagar({
      contaId: id,
      motivo: "Lancada em duplicidade",
    });
    expect(cancelled).toMatchObject({
      conta: { status: "CANCELLED", motivo: "Lancada em duplicidade" },
    });

    const second = await tools.criar_conta_a_pagar({
      descricao: "Outro",
      valorReais: 100,
      vencimento: "2026-11-11",
      categoria: "Aluguel",
    });
    const paidId = (second.contas as Array<{ id: string }>)[0].id;
    await tools.registrar_pagamento_conta({
      contaId: paidId,
      valorReais: 50,
      dataPagamento: "2026-11-10",
      contaFinanceira: "acc-1",
    });
    await expect(
      tools.cancelar_conta_a_pagar({ contaId: paidId, motivo: "Teste" })
    ).rejects.toThrow("Conta com pagamento registrado nao pode ser cancelada");
  });
});
