import { ConflictException, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import { FiscalDocumentStorageService } from "../src/management/fiscal/documents/fiscal-document-storage.service";
import { FiscalXmlExportService } from "../src/management/fiscal/documents/fiscal-xml-export.service";
import { createFiscalHarness, OTHER_TENANT, OWNER_ID, SODA, TENANT } from "./support/fiscal-harness";

describe("NFC-e emission (US3)", () => {
  it("emits automatically a paid counter sale of the day, with complements as items, and stores XML/DANFE", async () => {
    const h = createFiscalHarness();
    const orderId = h.seedOrder();

    await h.trigger.requestForOrder(TENANT, orderId);
    await h.runJobs();

    const [document] = h.documentsOf();
    expect(document).toMatchObject({ status: "AUTHORIZED", trigger: "AUTOMATIC", activeKey: `order:${orderId}`, number: 1, series: 1 });
    const draft = document.payloadSnapshot as { items: Array<{ description: string; grossAmount: string }>; payments: unknown[] };
    expect(draft.items.map((item) => [item.description, item.grossAmount])).toEqual([["Hot Dog", "25.00"], ["Bacon extra", "3.00"]]);
    expect(draft.payments).toEqual([{ method: "PIX", tPag: "17", amount: "28.00" }]);
    expect(document.xmlAssetKey).toMatch(/^fiscal\/11111111-1111-4111-8111-111111111111\/\d{4}\/\d{2}\/.+\.xml$/);
    expect(h.files.has(document.danfeAssetKey as string)).toBe(true);
    expect(h.events(document.id)).toEqual(["CREATED", "SUBMITTED", "AUTHORIZED", "DOCUMENTS_STORED"]);
    expect(h.logs.find((log) => log.event === "fiscal.document.authorized")).toMatchObject({ saleToAuthorizationSeconds: expect.any(Number) });
  });

  it("does not emit automatically in manual mode, for unpaid sales or for sales of previous days", async () => {
    const h = createFiscalHarness();
    const unpaid = h.seedOrder({}, { paid: false });
    const yesterday = h.seedOrder({ source: "IMPORT", createdAt: new Date(Date.now() - 2 * 86_400_000) });
    await h.trigger.requestForOrder(TENANT, unpaid);
    await h.trigger.requestForOrder(TENANT, yesterday);
    h.prisma.table("fiscalConfiguration")[0].emissionMode = "MANUAL";
    await h.trigger.requestForOrder(TENANT, h.seedOrder());
    expect(h.documentsOf()).toHaveLength(0);
  });

  it("never emits for iFood sales imported as IMPORT", async () => {
    const h = createFiscalHarness();
    h.prisma.table("orderPlatform").push({ id: "plat-ifood", tenantId: TENANT, name: "IFOOD" } as never);
    const orderId = h.seedOrder({ source: "IMPORT", orderPlatformId: "plat-ifood", paymentInstitution: "IFOOD" });
    await h.trigger.requestForOrder(TENANT, orderId);
    expect(await h.trigger.sweep()).toBe(0);
    await expect(
      h.emissions.request({ tenantId: TENANT, target: { type: "ORDER", id: orderId }, trigger: "MANUAL" })
    ).rejects.toMatchObject({ response: { reason: "SOURCE_NOT_ELIGIBLE" } });
    expect(h.documentsOf()).toHaveLength(0);
  });

  it("requires explicit confirmation to emit a sale of a previous day manually", async () => {
    const h = createFiscalHarness();
    const orderId = h.seedOrder({ source: "IMPORT", createdAt: new Date(Date.now() - 2 * 86_400_000) });
    const request = { tenantId: TENANT, target: { type: "ORDER" as const, id: orderId }, trigger: "MANUAL" as const, actorUserId: OWNER_ID };

    await expect(h.emissions.request(request)).rejects.toBeInstanceOf(UnprocessableEntityException);
    const result = await h.emissions.request({ ...request, confirmRetroactive: true });
    await h.runJobs();

    expect(result.status).toBe("QUEUED");
    expect(h.documentsOf()[0]).toMatchObject({ status: "AUTHORIZED", trigger: "RETROACTIVE", requestedByUserId: OWNER_ID });
    expect(h.events(h.documentsOf()[0].id)).toContain("RETROACTIVE_CONFIRMED");
  });

  it("creates a single document under concurrent requests (SC-005)", async () => {
    const h = createFiscalHarness();
    const orderId = h.seedOrder();
    const request = { tenantId: TENANT, target: { type: "ORDER" as const, id: orderId }, trigger: "MANUAL" as const };

    const results = await Promise.allSettled([h.emissions.request(request), h.emissions.request(request)]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: expect.any(ConflictException) });
    expect(h.documentsOf()).toHaveLength(1);
  });

  it("recovers a timeout after the provider created the document without duplicating it (SC-005)", async () => {
    const h = createFiscalHarness();
    h.fake.createOutcomes = ["TIMEOUT_AFTER_CREATE"];
    await h.trigger.requestForOrder(TENANT, h.seedOrder());
    await h.runJobs();

    expect(h.fake.documents.size).toBe(1);
    expect(h.fake.calls.map((call) => call.method)).toContain("findByReference");
    expect(h.documentsOf()[0].status).toBe("AUTHORIZED");
  });

  it("retries a timeout before creation and authorizes on the next attempt", async () => {
    const h = createFiscalHarness();
    h.fake.createOutcomes = ["TIMEOUT_BEFORE_CREATE"];
    await h.trigger.requestForOrder(TENANT, h.seedOrder());
    await h.runJobs();

    expect(h.fake.documents.size).toBe(1);
    expect(h.documentsOf()[0].status).toBe("AUTHORIZED");
    expect(h.events(h.documentsOf()[0].id)).toContain("RETRY_SCHEDULED");
  });

  it("keeps the document active in ERROR after exhausting retries, and reprocessing authorizes it", async () => {
    const h = createFiscalHarness();
    h.fake.submitOutcomes = Array(6).fill("UNAVAILABLE");
    const orderId = h.seedOrder();
    await h.trigger.requestForOrder(TENANT, orderId);
    await h.runJobs();

    const [document] = h.documentsOf();
    expect(document).toMatchObject({ status: "ERROR", activeKey: `order:${orderId}`, rejectionCode: "UNAVAILABLE" });
    expect(h.logs.filter((log) => log.event === "fiscal.document.error")).toHaveLength(6);

    await h.emissions.enqueue(document as never);
    await h.runJobs();
    expect(h.documentsOf()[0].status).toBe("AUTHORIZED");
    expect(h.fake.documents.size).toBe(1);
  });

  it("follows PROCESSING documents through the sync job", async () => {
    const h = createFiscalHarness();
    h.fake.defaultSubmit = "PROCESSING";
    await h.trigger.requestForOrder(TENANT, h.seedOrder());
    await h.runJobs();
    const [document] = h.documentsOf();
    expect(document.status).toBe("PROCESSING");

    h.fake.documents.get(document.externalId as string)!.state = { ...(await h.fake.submit({} as never, document.externalId as string)), status: "PROCESSING" } as never;
    h.fake.defaultSubmit = "AUTHORIZE";
    await h.fake.submit({} as never, document.externalId as string);
    document.nextSyncAt = new Date(Date.now() - 1000);
    expect(await h.sync.enqueueDue()).toBe(1);
    await h.runJobs();
    expect(h.documentsOf()[0].status).toBe("AUTHORIZED");
  });

  it("releases the sale on rejection so a corrected emission creates a new document", async () => {
    const h = createFiscalHarness();
    h.fake.submitOutcomes = ["REJECT"];
    const orderId = h.seedOrder();
    await h.trigger.requestForOrder(TENANT, orderId);
    await h.runJobs();
    expect(h.documentsOf()[0]).toMatchObject({ status: "REJECTED", activeKey: null, rejectionCode: "778" });

    const pending = await h.documents.list(TENANT, { pendingOnly: true });
    expect(pending.items.map((item) => item.pendingReason)).toEqual(["REJECTED"]);

    await h.emissions.request({ tenantId: TENANT, target: { type: "ORDER", id: orderId }, trigger: "MANUAL" });
    await h.runJobs();
    expect(h.documentsOf().map((document) => document.status).sort()).toEqual(["AUTHORIZED", "REJECTED"]);
    expect((await h.documents.list(TENANT, { pendingOnly: true })).items).toEqual([]);
  });

  it("rejects locally when an item has no fiscal profile and does not retry automatically", async () => {
    const h = createFiscalHarness();
    h.prisma.table("category")[0].fiscalProfileId = null;
    const orderId = h.seedOrder();
    await h.trigger.requestForOrder(TENANT, orderId);
    await h.trigger.requestForOrder(TENANT, orderId);

    expect(h.documentsOf()).toHaveLength(1);
    expect(h.documentsOf()[0]).toMatchObject({ status: "REJECTED", rejectionCode: "MISSING_FISCAL_DATA" });
    expect(h.fake.calls).toEqual([]);
    expect((await h.documents.list(TENANT, { pendingOnly: true })).items[0].pendingReason).toBe("MISSING_FISCAL_DATA");
  });

  it("issues one NFC-e for the whole tab when it is paid", async () => {
    const h = createFiscalHarness();
    const tabId = randomUUID();
    h.prisma.table("serviceTab").push({ id: tabId, tenantId: TENANT, publicCode: "C7", status: "PAID", consumerDocument: "52998224725", openedAt: new Date(), closedAt: new Date() } as never);
    const first = h.seedOrder({ serviceTabId: tabId, total: "28.00" });
    h.seedOrder({ serviceTabId: tabId, total: "6.00" }, { complement: false, items: [{ productId: SODA, productNameSnapshot: "Refrigerante", quantity: 1, unitPrice: new Prisma.Decimal(6), total: new Prisma.Decimal(6), baseUnitPrice: null, calculatedUnitPrice: null, chargedUnitPrice: null }] });
    h.pay({ serviceTabId: tabId }, "CASH", "40.00");

    await h.trigger.requestForOrder(TENANT, first);
    await h.runJobs();

    const [document] = h.documentsOf();
    expect(document).toMatchObject({ serviceTabId: tabId, orderId: null, status: "AUTHORIZED", consumerDocument: "52998224725" });
    const draft = document.payloadSnapshot as { items: unknown[]; payments: unknown[]; change: string; total: string; consumer: unknown };
    expect(draft.items).toHaveLength(3);
    expect(draft).toMatchObject({ total: "34.00", change: "6.00", consumer: { document: "52998224725" }, payments: [{ method: "CASH", tPag: "01", amount: "40.00" }] });
    const info = await h.documents.forOrders(TENANT, [{ id: first, serviceTabId: tabId, source: "COUNTER", total: "28.00" }]);
    expect(info.get(first)).toMatchObject({ status: "AUTHORIZED", documentId: document.id });
  });

  it("issues the tab NFC-e when an order of the tab is emitted manually", async () => {
    const h = createFiscalHarness();
    const tabId = randomUUID();
    h.prisma.table("serviceTab").push({ id: tabId, tenantId: TENANT, publicCode: "C8", status: "PAID", openedAt: new Date(), closedAt: new Date() } as never);
    const orderId = h.seedOrder({ serviceTabId: tabId });
    h.pay({ serviceTabId: tabId }, "PIX", "28.00");

    await h.emissions.request({ tenantId: TENANT, target: { type: "ORDER", id: orderId }, trigger: "MANUAL" });

    expect(h.documentsOf()[0]).toMatchObject({ serviceTabId: tabId, orderId: null, activeKey: `tab:${tabId}` });
  });

  it("lists paid sales of the day without NFC-e for manual emission", async () => {
    const h = createFiscalHarness();
    h.prisma.table("fiscalConfiguration")[0].emissionMode = "MANUAL";
    const paid = h.seedOrder();
    h.seedOrder({}, { paid: false });
    const issued = h.seedOrder();
    await h.emissions.request({ tenantId: TENANT, target: { type: "ORDER", id: issued }, trigger: "MANUAL" });
    const tabId = randomUUID();
    h.prisma.table("serviceTab").push({ id: tabId, tenantId: TENANT, publicCode: "C5", status: "PAID", openedAt: new Date(), closedAt: new Date() } as never);
    h.seedOrder({ serviceTabId: tabId, total: "12.00" });
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

    const sales = await h.documents.unissued(TENANT, today);

    expect(sales.map((sale) => sale.target)).toEqual(expect.arrayContaining([{ type: "ORDER", id: paid }, { type: "TAB", id: tabId }]));
    expect(sales).toHaveLength(2);
    expect(sales.find((sale) => sale.target.type === "ORDER")).toMatchObject({ totalAmount: "28.00", paymentMethods: ["PIX"], lastAttempt: null });
    expect(sales.find((sale) => sale.target.type === "TAB")).toMatchObject({ totalAmount: "12.00", publicCode: "C5" });
    expect(await h.documents.unissued(OTHER_TENANT, today)).toEqual([]);
  });

  it("allows manual emission only for paid sales without NFC-e, pointing tab orders to the tab", async () => {
    const h = createFiscalHarness();
    h.prisma.table("fiscalConfiguration")[0].emissionMode = "MANUAL";
    const unpaid = h.seedOrder({}, { paid: false });
    const paid = h.seedOrder();
    const tabId = randomUUID();
    h.prisma.table("serviceTab").push({ id: tabId, tenantId: TENANT, publicCode: "C3", status: "OPEN", openedAt: new Date() } as never);
    const inTab = h.seedOrder({ serviceTabId: tabId, total: "12.00" });
    const status = async () => {
      const orders = h.prisma.table("order").filter((order) => ([unpaid, paid, inTab] as string[]).includes(order.id as string)) as never[];
      return h.documents.forOrders(TENANT, orders);
    };

    let info = await status();
    expect(info.get(unpaid)).toMatchObject({ status: "NOT_ISSUED", canEmit: false, blockedReason: "NOT_PAID", target: { type: "ORDER", id: unpaid } });
    expect(info.get(paid)).toMatchObject({ canEmit: true, blockedReason: null });
    expect(info.get(inTab)).toMatchObject({ canEmit: false, blockedReason: "TAB_NOT_PAID", target: { type: "TAB", id: tabId }, targetCode: "C3" });

    h.prisma.table("serviceTab").find((tab) => tab.id === tabId)!.status = "PAID";
    h.pay({ serviceTabId: tabId }, "CASH", "12.00");
    await h.emissions.request({ tenantId: TENANT, target: { type: "ORDER", id: paid }, trigger: "MANUAL" });
    info = await status();
    expect(info.get(inTab)).toMatchObject({ canEmit: true, target: { type: "TAB", id: tabId } });
    expect(info.get(paid)).toMatchObject({ status: "PENDING", canEmit: false, blockedReason: null });

    h.prisma.table("fiscalConfiguration")[0].enabled = false;
    expect((await status()).get(inTab)).toMatchObject({ canEmit: false, blockedReason: "DISABLED" });
  });

  it("blocks changes to orders with an active NFC-e", async () => {
    const h = createFiscalHarness();
    const orderId = h.seedOrder();
    await h.guard.assertMutable(TENANT, orderId);
    await h.trigger.requestForOrder(TENANT, orderId);
    await expect(h.guard.assertMutable(TENANT, orderId)).rejects.toMatchObject({ response: { code: "FISCAL_DOCUMENT_ACTIVE" } });
  });

  it("recovers same-day sales missed by the hooks in the sweep", async () => {
    const h = createFiscalHarness();
    h.seedOrder();
    h.seedOrder({ source: "PUBLIC_MENU" });
    expect(await h.trigger.sweep()).toBe(1);
    expect(h.logs.find((log) => log.event === "fiscal.trigger.recovered")).toBeDefined();
    expect(await h.trigger.sweep()).toBe(0);
  });

  it("keeps documents isolated per tenant", async () => {
    const h = createFiscalHarness();
    await h.trigger.requestForOrder(TENANT, h.seedOrder());
    const [document] = h.documentsOf();
    await expect(h.documents.detail(OTHER_TENANT, document.id)).rejects.toBeInstanceOf(NotFoundException);
    expect((await h.documents.list(OTHER_TENANT, {})).total).toBe(0);
    await expect(
      h.emissions.request({ tenantId: OTHER_TENANT, target: { type: "ORDER", id: document.orderId as string }, trigger: "MANUAL" })
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe("NFC-e cancellation (US4, SC-003)", () => {
  async function authorized(h: ReturnType<typeof createFiscalHarness>) {
    const orderId = h.seedOrder();
    await h.trigger.requestForOrder(TENANT, orderId);
    await h.runJobs();
    return { orderId, document: h.documentsOf()[0] };
  }

  it("assisted flow: notifies urgently and detects the cancellation done in the provider panel", async () => {
    const h = createFiscalHarness();
    const { orderId, document } = await authorized(h);

    await h.cancellations.requestForOrder(TENANT, orderId, "Cliente desistiu da compra", OWNER_ID, "ORDER_CANCELLED");

    expect(h.documentsOf()[0]).toMatchObject({ status: "CANCEL_PENDING", cancelReason: "Cliente desistiu da compra" });
    const deadline = h.documentsOf()[0].cancelDeadlineAt as Date;
    expect(deadline.getTime() - (document.authorizedAt as Date).getTime()).toBe(30 * 60_000);
    const [notification] = h.prisma.table("operationalNotification");
    expect(notification).toMatchObject({ recipientUserId: OWNER_ID, type: "FISCAL_CANCEL_MANUAL_REQUIRED", severity: "ERROR", actionUrl: "/admin/fiscal?tab=pendencias" });
    expect((await h.documents.list(TENANT, { pendingOnly: true })).items[0]).toMatchObject({ pendingReason: "CANCEL_MANUAL_REQUIRED", providerPanelUrl: expect.stringContaining(document.externalId as string) });

    h.fake.cancelExternally(document.externalId as string);
    h.documentsOf()[0].nextSyncAt = new Date(Date.now() - 1000);
    await h.sync.enqueueDue();
    await h.runJobs();

    expect(h.documentsOf()[0]).toMatchObject({ status: "CANCELLED", activeKey: null });
    expect(h.files.has(h.documentsOf()[0].cancelXmlAssetKey as string)).toBe(true);
    expect(h.logs.find((log) => log.event === "fiscal.document.cancelled")).toMatchObject({ via: "PROVIDER_PANEL" });
  });

  it("uses a short reason fallback and sends the reminder before the deadline", async () => {
    const h = createFiscalHarness();
    const { orderId } = await authorized(h);
    await h.cancellations.requestForOrder(TENANT, orderId, "curto", null, "ORDER_DELETED");
    expect(h.documentsOf()[0].cancelReason).toBe("Venda cancelada a pedido do cliente");

    h.documentsOf()[0].cancelReminderAt = new Date(Date.now() - 1000);
    await h.sync.sendReminders();
    expect(h.prisma.table("operationalNotification").map((item) => item.type)).toEqual(["FISCAL_CANCEL_MANUAL_REQUIRED", "FISCAL_CANCEL_REMINDER"]);
    expect(h.documentsOf()[0].cancelReminderAt).toBeNull();
  });

  it("marks CANCEL_FAILED after the deadline and still detects a late cancellation", async () => {
    const h = createFiscalHarness();
    const { orderId, document } = await authorized(h);
    await h.cancellations.requestForOrder(TENANT, orderId, "Cliente desistiu da compra", null, "ORDER_CANCELLED");
    const row = h.documentsOf()[0];
    row.cancelDeadlineAt = new Date(Date.now() - 1000);

    await h.sync.sync(row as never);
    expect(h.documentsOf()[0].status).toBe("CANCEL_FAILED");
    expect(h.prisma.table("operationalNotification").map((item) => item.type)).toContain("FISCAL_CANCEL_FAILED");

    h.fake.cancelExternally(document.externalId as string);
    await h.sync.sync(h.documentsOf()[0] as never);
    expect(h.documentsOf()[0].status).toBe("CANCELLED");
  });

  it("cancels through the API when the provider supports it", async () => {
    const h = createFiscalHarness({ capabilities: { cancelViaApi: true, usesOwnCertificate: false } });
    const { orderId } = await authorized(h);
    await h.cancellations.requestForOrder(TENANT, orderId, "Cliente desistiu da compra", null, "ORDER_CANCELLED");
    await h.runJobs();

    expect(h.documentsOf()[0]).toMatchObject({ status: "CANCELLED", cancelProtocol: "135000000000001" });
    expect(h.prisma.table("operationalNotification")).toHaveLength(0);
    expect(h.logs.find((log) => log.event === "fiscal.document.cancelled")).toMatchObject({ via: "API" });
  });

  it("cancels right after authorization when the sale was cancelled during processing", async () => {
    const h = createFiscalHarness();
    h.fake.defaultSubmit = "PROCESSING";
    const orderId = h.seedOrder();
    await h.trigger.requestForOrder(TENANT, orderId);
    await h.runJobs();
    await h.cancellations.requestForOrder(TENANT, orderId, "Cliente desistiu da compra", null, "ORDER_CANCELLED");
    expect(h.documentsOf()[0]).toMatchObject({ status: "PROCESSING", cancelRequestedAt: expect.any(Date) });

    h.fake.defaultSubmit = "AUTHORIZE";
    await h.fake.submit({} as never, h.documentsOf()[0].externalId as string);
    await h.sync.sync(h.documentsOf()[0] as never);

    expect(h.documentsOf()[0].status).toBe("CANCEL_PENDING");
  });

  it("cancels the tab document when an order of a paid tab is cancelled, and ignores sales without NFC-e", async () => {
    const h = createFiscalHarness();
    const tabId = randomUUID();
    h.prisma.table("serviceTab").push({ id: tabId, tenantId: TENANT, publicCode: "C9", status: "PAID", openedAt: new Date(), closedAt: new Date() } as never);
    const orderId = h.seedOrder({ serviceTabId: tabId });
    h.pay({ serviceTabId: tabId }, "PIX", "28.00");
    await h.trigger.requestForOrder(TENANT, orderId);
    await h.runJobs();

    await h.cancellations.requestForOrder(TENANT, orderId, "Cliente desistiu da compra", null, "ORDER_CANCELLED");
    expect(h.documentsOf()[0]).toMatchObject({ serviceTabId: tabId, status: "CANCEL_PENDING" });

    expect(await h.cancellations.requestForOrder(TENANT, h.seedOrder({}, { paid: false }), null, null, "ORDER_CANCELLED")).toBeNull();
  });
});

describe("XML export for the accountant (US8)", () => {
  function zipEntryNames(zip: Buffer): string[] {
    const names: string[] = [];
    let offset = 0;
    while (zip.readUInt32LE(offset) === 0x04034b50) {
      const size = zip.readUInt32LE(offset + 18);
      const nameLength = zip.readUInt16LE(offset + 26);
      names.push(zip.subarray(offset + 30, offset + 30 + nameLength).toString());
      offset += 30 + nameLength + size;
    }
    return names;
  }

  it("bundles authorized and cancelled notes with a summary, keeping homologation apart", async () => {
    const h = createFiscalHarness({ capabilities: { cancelViaApi: true, usesOwnCertificate: false } });
    const first = h.seedOrder();
    const second = h.seedOrder();
    await h.trigger.requestForOrder(TENANT, first);
    await h.trigger.requestForOrder(TENANT, second);
    await h.runJobs();
    await h.cancellations.requestForOrder(TENANT, second, "Cliente desistiu da compra", null, "ORDER_CANCELLED");
    await h.runJobs();
    const [authorized, cancelled] = h.documentsOf();
    const storage = new FiscalDocumentStorageService({
      read: async (key: string) => ({ body: (await import("node:stream")).Readable.from(h.files.get(key) as Buffer) }),
    } as never);
    const exporter = new FiscalXmlExportService(h.prisma as never, storage, h.documents, { log: () => undefined } as never);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

    const homologation = await exporter.build(TENANT, { from: today, to: today, environment: "HOMOLOGATION" });

    expect(homologation.count).toBe(2);
    expect(homologation.fileName).toBe(`nfce-${today}-a-${today}-homologacao.zip`);
    expect(zipEntryNames(homologation.content).sort()).toEqual(
      [
        `autorizadas/${authorized.accessKey}.xml`,
        `canceladas/${cancelled.accessKey}.xml`,
        `canceladas/${cancelled.accessKey}-cancelamento.xml`,
        "resumo.csv",
      ].sort()
    );
    expect(homologation.content.toString()).toContain(";CANCELLED;HOMOLOGATION;ok");

    const production = await exporter.build(TENANT, { from: today, to: today });
    expect(production.count).toBe(0);
    expect(zipEntryNames(production.content)).toEqual(["resumo.csv"]);
    await expect(exporter.build(TENANT, { from: today, to: "2020-01-01" })).rejects.toMatchObject({ response: { code: "INVALID_PERIOD" } });
    expect((await exporter.build(OTHER_TENANT, { from: today, to: today, environment: "HOMOLOGATION" })).count).toBe(0);
  });
});
