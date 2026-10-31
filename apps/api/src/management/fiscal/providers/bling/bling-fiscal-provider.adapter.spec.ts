import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { NfceDraft, ProviderContext } from "../fiscal-provider.adapter";
import { BlingFiscalProviderAdapter } from "./bling-fiscal-provider.adapter";
import { BlingClient } from "./bling.client";
import { blingDateTime, parseSendResult, toBlingNfce } from "./bling-nfce.mapper";

const fixture = (name: string) => readFileSync(join(__dirname, "__fixtures__", name), "utf8");
const ctx: ProviderContext = {
  tenantId: "t1",
  environment: "HOMOLOGATION",
  accessToken: "token",
  settings: {
    naturezaOperacaoId: "15111821399",
    paymentMethodMap: { CASH: "11508877", PIX: "11511058", PIX_MANUAL: "11508883", DEBIT_CARD: "11511042", CREDIT_CARD: "11511041", VOUCHER: "11511057" },
  },
};
const draft = (overrides: Partial<NfceDraft> = {}): NfceDraft => ({
  reference: "doc-1",
  environment: "HOMOLOGATION",
  issuer: {} as never,
  consumer: null,
  items: [
    { code: "TESTE-RRF5-1", description: "Hot Dog", quantity: "1.0000", unitPrice: "25", grossAmount: "25.00", discount: "2.00", freight: "0.00", otherExpenses: "0.00", ncm: "21069090", cfop: "5102", csosn: "102", origin: 0, unit: "UN", cest: null, benefitCode: null },
    { code: "bacon", description: "Bacon extra", quantity: "1.0000", unitPrice: "3", grossAmount: "3.00", discount: "0.00", freight: "0.00", otherExpenses: "0.50", ncm: "16010000", cfop: "5102", csosn: "500", origin: 0, unit: "UN", cest: "1700100", benefitCode: null },
  ],
  payments: [
    { method: "PIX", tPag: "17", amount: "10.00" },
    { method: "CASH", tPag: "01", amount: "20.00" },
  ],
  change: "3.50",
  total: "26.50",
  saleOccurredAt: "2026-10-30T21:00:00.000Z",
  additionalInfo: "Pedido B12",
  ...overrides,
});

describe("Bling NFC-e mapper", () => {
  it("builds the create payload validated in homologation", () => {
    const now = new Date("2026-10-30T21:26:45.000Z");
    expect(toBlingNfce(draft(), ctx.settings, now)).toEqual({
      tipo: 1,
      dataOperacao: "2026-10-30 18:26:45",
      contato: { nome: "Consumidor final", tipoPessoa: "F", numeroDocumento: "", contribuinte: 9 },
      naturezaOperacao: { id: 15111821399 },
      desconto: 2,
      despesas: 0.5,
      observacoes: "Pedido B12 | Ref. doc-1",
      itens: [
        { codigo: "TESTE-RRF5-1", descricao: "Hot Dog", unidade: "UN", quantidade: 1, valor: 25, tipo: "P", classificacaoFiscal: "2106.90.90", origem: 0, cfop: "5102" },
        { codigo: "bacon", descricao: "Bacon extra", unidade: "UN", quantidade: 1, valor: 3, tipo: "P", classificacaoFiscal: "1601.00.00", cest: "17.001.00", origem: 0, cfop: "5102" },
      ],
      parcelas: [
        { data: "2026-10-30", valor: 10, formaPagamento: { id: 11511058 } },
        { data: "2026-10-30", valor: 16.5, formaPagamento: { id: 11508877 } },
      ],
    });
  });

  it("identifies the consumer and refuses unmapped payment methods or missing nature", () => {
    expect(toBlingNfce(draft({ consumer: { document: "52998224725" } }), ctx.settings).contato).toEqual({
      nome: "Consumidor",
      tipoPessoa: "F",
      numeroDocumento: "52998224725",
      contribuinte: 9,
    });
    expect(() => toBlingNfce(draft({ payments: [{ method: "DIGITAL_WALLET", tPag: "18", amount: "26.50" }] }), ctx.settings)).toThrow(
      /Carteira digital/
    );
    expect(() => toBlingNfce(draft(), {})).toThrow(/Natureza de operacao/);
  });

  it("reads the SEFAZ answer of the send call (authorized and rejected)", () => {
    expect(parseSendResult("1", JSON.parse(fixture("enviar-authorized.json")))).toMatchObject({
      status: "AUTHORIZED",
      accessKey: "35261011222333000181650010000000041689756832",
      protocol: "135260000000001",
      authorizedAt: "2026-10-30T18:26:46-03:00",
    });
    expect(parseSendResult("1", JSON.parse(fixture("enviar-rejected-717.json")))).toEqual({
      status: "REJECTED",
      externalId: "1",
      code: "717",
      message: "Rejeição: NFC-e ou NF-e com DANFE Simplificado Tipo 2 em operação não permitida",
    });
    expect(parseSendResult("1", JSON.parse(fixture("enviar-rejected-899.json")))).toMatchObject({ status: "REJECTED", code: "899" });
    // SEFAZ reasons may point the item between brackets; the batch "Lote processado" must not win.
    const bracketed = fixture("enviar-rejected-717.json")
      .replace("<cStat>717</cStat>", "<cStat>386</cStat>")
      .replace(/(<infProt>[\s\S]*?<xMotivo>)[^<]*(<\/xMotivo>)/, "$1Rejeição: CFOP não permitido para o CSOSN informado [nItem:4]$2");
    expect(parseSendResult("1", JSON.parse(bracketed))).toEqual({
      status: "REJECTED",
      externalId: "1",
      code: "386",
      message: "Rejeição: CFOP não permitido para o CSOSN informado [nItem:4]",
    });
    expect(() => parseSendResult("1", { data: {} })).toThrow(/inesperada/);
  });

  it("formats dates in São Paulo time", () => {
    expect(blingDateTime(new Date("2026-10-31T02:59:59.000Z"))).toBe("2026-10-30 23:59:59");
  });
});

describe("BlingFiscalProviderAdapter", () => {
  let adapter: BlingFiscalProviderAdapter;
  let requests: Array<{ method: string; url: string; body?: string; auth?: string }>;
  let routes: Record<string, { status: number; body: string }>;

  beforeEach(() => {
    requests = [];
    routes = {};
    const client = new BlingClient({ value: async () => "https://api.bling.test/Api/v3" } as never);
    client.intervalMs = 0;
    client.useFetcher(async (url, init) => {
      requests.push({ method: init.method, url, body: init.body, auth: init.headers.Authorization });
      const route = routes[`${init.method} ${url}`] ?? routes[`${init.method} ${url.split("?")[0]}`];
      if (!route) return { ok: false, status: 404, text: async () => "{}" };
      return { ok: route.status < 400, status: route.status, text: async () => route.body };
    });
    adapter = new BlingFiscalProviderAdapter(client);
  });

  const xmlUrl = () => JSON.parse(fixture("get-authorized.json")).data.xml as string;

  it("creates, sends and returns the authorized state with number, QR code and DANFE link", async () => {
    routes["POST https://api.bling.test/Api/v3/nfce"] = { status: 201, body: fixture("create-201.json") };
    routes["POST https://api.bling.test/Api/v3/nfce/27268975683/enviar"] = { status: 200, body: fixture("enviar-authorized.json") };
    routes["GET https://api.bling.test/Api/v3/nfce/27268975683"] = { status: 200, body: fixture("get-authorized.json") };
    routes[`GET ${xmlUrl()}`] = { status: 200, body: fixture("nfce-authorized.xml") };

    const { externalId } = await adapter.create(ctx, draft());
    const state = await adapter.submit(ctx, externalId);

    expect(externalId).toBe("27268975683");
    expect(requests[0]).toMatchObject({ method: "POST", auth: "Bearer token" });
    expect(state).toMatchObject({
      status: "AUTHORIZED",
      number: 4,
      series: 1,
      accessKey: "35261011222333000181650010000000041689756832",
      protocol: "135260000000001",
      consultationUrl: "https://www.homologacao.nfce.fazenda.sp.gov.br/consulta",
      danfeUrl: expect.stringContaining("doc.view.php"),
    });
    expect(state.status === "AUTHORIZED" && state.qrCodeUrl).toContain("homologacao.nfce.fazenda.sp.gov.br/qrcode");
    const xml = await adapter.downloadXml(ctx, externalId, "AUTHORIZATION");
    expect(xml?.toString()).toContain("<nfeProc");
    expect(await adapter.downloadXml(ctx, externalId, "CANCELLATION")).toBeNull();
    expect(await adapter.downloadDanfe()).toBeNull();
  });

  it("maps a rejected document and Bling validation errors", async () => {
    routes["GET https://api.bling.test/Api/v3/nfce/27268944672"] = { status: 200, body: fixture("get-rejected.json") };
    expect(await adapter.get(ctx, "27268944672")).toMatchObject({ status: "REJECTED", code: "BLING_SITUACAO_4" });

    routes["POST https://api.bling.test/Api/v3/nfce"] = {
      status: 400,
      body: JSON.stringify({ error: { type: "VALIDATION_ERROR", message: "Nao foi possivel salvar", fields: [{ msg: "Parcelas", collection: [{ msg: "Id da forma de pagamento invalido." }] }] } }),
    };
    await expect(adapter.create(ctx, draft())).rejects.toMatchObject({ code: "VALIDATION", retryable: false, message: "Nao foi possivel salvar: Id da forma de pagamento invalido." });
  });

  it("classifies transport errors for the retry policy", async () => {
    routes["GET https://api.bling.test/Api/v3/nfce/1"] = { status: 429, body: "{}" };
    await expect(adapter.get(ctx, "1")).rejects.toMatchObject({ code: "RATE_LIMIT", retryable: true });
    routes["GET https://api.bling.test/Api/v3/nfce/1"] = { status: 503, body: "{}" };
    await expect(adapter.get(ctx, "1")).rejects.toMatchObject({ code: "UNAVAILABLE", retryable: true });
    routes["GET https://api.bling.test/Api/v3/nfce/1"] = { status: 401, body: "{}" };
    await expect(adapter.get(ctx, "1")).rejects.toMatchObject({ code: "AUTHENTICATION", providerCode: "PROVIDER_DISCONNECTED" });
  });

  it("finds a document created before a timeout by total and item codes", async () => {
    routes["GET https://api.bling.test/Api/v3/nfce"] = {
      status: 200,
      body: JSON.stringify({ data: [{ id: 222 }, { id: 111, valorNota: 99 }, { id: 27268975683 }] }),
    };
    routes["GET https://api.bling.test/Api/v3/nfce/222"] = {
      status: 200,
      body: JSON.stringify({ data: { ...JSON.parse(fixture("get-authorized.json")).data, id: 222, valorNota: 7 } }),
    };
    routes["GET https://api.bling.test/Api/v3/nfce/27268975683"] = { status: 200, body: fixture("get-authorized.json") };
    const single = draft({
      total: "1.00",
      items: [{ ...draft().items[0], grossAmount: "1.00", discount: "0.00" }],
    });
    expect(await adapter.findByReference(ctx, single)).toEqual({ externalId: "27268975683" });
    expect(requests.some((request) => request.url.includes("/nfce/111"))).toBe(false);
    expect(await adapter.findByReference(ctx, draft())).toBeNull();
  });

  it("reports missing settings for the readiness checklist", () => {
    expect(adapter.validateSettings(ctx.settings)).toEqual([]);
    expect(adapter.validateSettings({ paymentMethodMap: { CASH: "1" } })).toEqual([
      { key: "OPERATION_NATURE", message: "Escolha a natureza de operacao do Bling usada nas NFC-e" },
      { key: "PAYMENT_MAP", message: "Vincule as formas de pagamento do Bling: Pix (maquininha), Pix manual, Cartao de debito, Cartao de credito, Vale-refeicao" },
    ]);
  });
});
