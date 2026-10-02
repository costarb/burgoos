import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dayEnd, dayStart, endOfDay, parseDate } from "../src/common/reporting/report-period";
import { McpRequestContext } from "../src/management/mcp/server/mcp-context";
import { CashTools } from "../src/management/mcp/tools/cash.tools";
import { FinancialTools } from "../src/management/mcp/tools/financial.tools";
import { InventoryTools } from "../src/management/mcp/tools/inventory.tools";
import { MenuTools } from "../src/management/mcp/tools/menu.tools";
import { PayablesTools } from "../src/management/mcp/tools/payables.tools";
import { SalesTools } from "../src/management/mcp/tools/sales.tools";
import { McpToolDefinition } from "../src/management/mcp/tools/tool-output";
import { parseManagementReportQuery } from "../src/management/reports/management-report.types";
import { parseSalesReportQuery } from "../src/management/reports/sales-report.types";
import { createServiceMocks, ServiceMocks, STORE_A } from "./support/mcp-service-fixtures";

/**
 * SC-002: each tool must call the same service, with the same parameters the admin screen
 * sends, and keep its figures. Values here come from the service mocks' outputs.
 */
describe("MCP tools parity with admin screens", () => {
  let services: ServiceMocks;
  let tools: Map<string, McpToolDefinition>;
  const context: McpRequestContext = {
    tenantId: STORE_A,
    tokenId: "token-1",
    enabledAreas: [],
    storeName: "Loja Centro",
    storeSlug: "loja-centro",
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T15:00:00.000Z"));
    services = createServiceMocks();
    const definitions = [
      ...new SalesTools(services.sales as never, services.reports as never, services.management as never).definitions(),
      ...new FinancialTools(services.dre as never, services.dashboard as never).definitions(),
      ...new MenuTools(services.menu as never).definitions(),
      ...new CashTools(services.cashFlow as never).definitions(),
      ...new PayablesTools(services.payables as never).definitions(),
      ...new InventoryTools(services.inventory as never).definitions(),
    ];
    tools = new Map(definitions.map((definition) => [definition.name, definition]));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const call = (name: string, args: Record<string, unknown> = {}) =>
    tools.get(name)!.handler(context, args);

  it("resumo_vendas uses the sales report query of the screen", async () => {
    const output = await call("resumo_vendas", {
      inicio: "2026-09-01",
      fim: "2026-09-30",
      meiosPagamento: ["PIX"],
      status: ["DELIVERED", "CANCELLED"],
    });

    expect(services.sales.getReport).toHaveBeenCalledWith(
      STORE_A,
      parseSalesReportQuery({
        start: "2026-09-01",
        end: "2026-09-30",
        paymentMethod: ["PIX"],
        status: ["DELIVERED", "CANCELLED"],
        page: "1",
        pageSize: "1",
      })
    );
    const report = await services.sales.getReport.mock.results[0].value;
    expect(output).toMatchObject({
      totais: {
        pedidos: report.summary.orderCount,
        faturamentoBrutoReais: Number(report.summary.grossRevenue),
        receitaLiquidaReais: Number(report.summary.acquiredNetRevenue),
        ticketMedioReais: Number(report.summary.averageTicket),
        taxasPagamentoReais: Number(report.summary.paymentFeeAmount),
      },
    });
  });

  it("resumo_vendas defaults to the screen's rolling 31 days", async () => {
    const output = await call("resumo_vendas");
    expect(output.periodo).toEqual({
      inicio: "2026-09-01",
      fim: "2026-10-01",
      fuso: "America/Sao_Paulo",
      padraoAplicado: true,
    });
  });

  it("relatorio_gerencial uses the management report query", async () => {
    await call("relatorio_gerencial", { inicio: "2026-09-01", fim: "2026-09-30" });
    expect(services.management.getReport).toHaveBeenCalledWith(
      STORE_A,
      parseManagementReportQuery({ start: "2026-09-01", end: "2026-09-30" })
    );
  });

  it("resumo_diario passes the business date", async () => {
    const output = await call("resumo_diario", { data: "2026-09-15" });
    expect(services.reports.getDailySummary).toHaveBeenCalledWith(STORE_A, "2026-09-15");
    expect(output).toMatchObject({ data: "2026-09-15", pedidos: 30, faturamentoBrutoReais: 1500.5 });
  });

  it("dre and engenharia_cardapio use the same day boundaries as their controllers", async () => {
    const dre = await call("dre", { inicio: "2026-09-01", fim: "2026-09-30" });
    expect(services.dre.getSummary).toHaveBeenCalledWith(
      STORE_A,
      dayStart("2026-09-01"),
      dayEnd("2026-09-30")
    );
    expect(dre).toMatchObject({
      receitaBrutaReais: 1500.5,
      cmvReais: 435.15,
      lucroLiquidoEstimadoReais: 370.3,
      margemLiquidaPercentual: 25.5,
      pontoEquilibrioReais: 833.33,
    });

    await call("engenharia_cardapio", { inicio: "2026-09-01", fim: "2026-09-30" });
    expect(services.menu.getReport).toHaveBeenCalledWith(
      STORE_A,
      dayStart("2026-09-01"),
      dayEnd("2026-09-30")
    );
  });

  it("dre defaults to the current month like the DRE screen", async () => {
    const output = await call("dre");
    expect(output.periodo).toMatchObject({ inicio: "2026-10-01", fim: "2026-10-31", padraoAplicado: true });
  });

  it("cash tools use the same date handling as the cash flow controller", async () => {
    await call("posicao_caixa", { dataReferencia: "2026-10-01", projecaoAte: "2026-10-31" });
    expect(services.cashFlow.getPosition).toHaveBeenCalledWith(
      STORE_A,
      endOfDay(parseDate("2026-10-01")),
      endOfDay(parseDate("2026-10-31"))
    );

    const statement = await call("extrato_caixa", { inicio: "2026-09-01", fim: "2026-09-30" });
    expect(services.cashFlow.getStatement).toHaveBeenCalledWith(
      STORE_A,
      parseDate("2026-09-01"),
      endOfDay(parseDate("2026-09-30"))
    );
    expect(statement).toMatchObject({
      saldoInicialReais: 4700,
      saldoFinalReais: 5000,
      entradasReais: 1400,
      saidasReais: 1100,
    });
  });

  it("contas_a_pagar applies the screen filters (category, supplier, competence) by name", async () => {
    const output = await call("contas_a_pagar", {
      categorias: ["aluguel centro"],
      fornecedores: ["FORNECEDOR CENTRO"],
      mesCompetencia: "2026-09",
      status: ["OPEN"],
    });

    const filters = { categoryId: ["cat-1"], supplierId: ["supplier-1"], competenceMonth: "2026-09" };
    expect(services.payables.list).toHaveBeenCalledWith(STORE_A, {
      ...filters,
      status: ["OPEN"],
      page: 1,
      pageSize: 50,
    });
    expect(services.payables.summarizeByCategory).toHaveBeenCalledWith(STORE_A, filters);
    expect(output).toMatchObject({
      periodo: { inicio: null, fim: null, criterio: "vencimento", padraoAplicado: false },
      filtros: {
        status: ["OPEN"],
        categorias: ["Aluguel Centro"],
        fornecedores: ["Fornecedor Centro"],
        mesCompetencia: "2026-09",
      },
      contas: [expect.objectContaining({ competencia: "2026-10-01", vencimento: "2026-10-10" })],
    });
  });

  it("contas_a_pagar rejects unknown categories listing the valid names", async () => {
    await expect(call("contas_a_pagar", { categorias: ["Marketing"] })).rejects.toThrow(
      "Categoria nao encontrada: Marketing. Opcoes: Aluguel Centro."
    );
    expect(services.payables.list).not.toHaveBeenCalled();
  });

  it("contas_a_pagar and estoque call the payables and inventory services", async () => {
    const payables = await call("contas_a_pagar", {
      inicio: "2026-09-01",
      fim: "2026-10-31",
      status: ["OVERDUE"],
    });
    expect(services.payables.list).toHaveBeenCalledWith(STORE_A, {
      start: "2026-09-01",
      end: "2026-10-31",
      status: ["OVERDUE"],
      page: 1,
      pageSize: 50,
    });
    expect(services.payables.summarizeByCategory).toHaveBeenCalledWith(STORE_A, {
      start: "2026-09-01",
      end: "2026-10-31",
    });
    expect(payables).toMatchObject({
      totais: { previstoReais: 1000, pagoReais: 200, restanteReais: 800, vencidoReais: 150 },
    });

    const inventory = await call("estoque");
    expect(services.inventory.listBalances).toHaveBeenCalledWith(STORE_A);
    expect(inventory).toMatchObject({ totais: { ingredientes: 2, insuficiente: 1, ok: 1 } });
  });
});
