import { describe, expect, it, vi } from "vitest";
import { isTemporaryStorage } from "../../../common/storage/storage-health";
import { FiscalFileRecoveryService } from "./fiscal-file-recovery.service";

const TENANT = "1b02924c-63ff-430a-a45d-df516a0bb5b4";

type Doc = {
  id: string;
  tenantId: string;
  status: "AUTHORIZED" | "CANCELLED";
  externalId: string | null;
  xmlAssetKey: string | null;
  cancelXmlAssetKey: string | null;
  filesMissingAt: Date | null;
  filesMissingReason: string | null;
};

function setup(docs: Doc[], files: Set<string>, providerHas: (doc: Doc, kind: string) => boolean) {
  const rows = new Map(docs.map((doc) => [doc.id, { ...doc }]));
  const prisma = {
    fiscalDocument: {
      findMany: vi.fn(async ({ where, take }: { where: { id?: { gt: string } }; take: number }) =>
        [...rows.values()]
          .filter((doc) => !where.id || doc.id > where.id.gt)
          .sort((a, b) => a.id.localeCompare(b.id))
          .slice(0, take)
      ),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => rows.get(where.id)),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Doc> }) => {
        Object.assign(rows.get(where.id)!, data);
        return rows.get(where.id);
      }),
    },
  };
  const states = {
    storeFiles: vi.fn(async (doc: Doc, kind: string, options: { checkTaxes?: boolean }) => {
      expect(options).toEqual({ checkTaxes: false });
      if (!providerHas(doc, kind)) return [];
      const key = `fiscal/${TENANT}/2026/11/${doc.id}${kind === "CANCELLATION" ? "-cancelamento" : ""}.xml`;
      files.add(key);
      Object.assign(rows.get(doc.id)!, kind === "CANCELLATION" ? { cancelXmlAssetKey: key } : { xmlAssetKey: key });
      return [kind === "CANCELLATION" ? "cancelXmlAssetKey" : "xmlAssetKey"];
    }),
  };
  const logs: Array<[string, Record<string, unknown>]> = [];
  const audit = { log: vi.fn((event: string, fields: Record<string, unknown>) => logs.push([event, fields])) };
  const jobs = { enqueue: vi.fn(async () => ({ id: "job-1", status: "PENDING" })) };
  const storage = { exists: vi.fn(async (key: string) => files.has(key)) };
  const service = new FiscalFileRecoveryService(
    prisma as never,
    states as never,
    audit as never,
    jobs as never,
    storage as never
  );
  return { service, rows, states, logs, jobs };
}

const doc = (id: string, overrides: Partial<Doc> = {}): Doc => ({
  id,
  tenantId: TENANT,
  status: "AUTHORIZED",
  externalId: `ext-${id}`,
  xmlAssetKey: `fiscal/${TENANT}/2026/11/old-${id}.xml`,
  cancelXmlAssetKey: null,
  filesMissingAt: null,
  filesMissingReason: null,
  ...overrides,
});

describe("FiscalFileRecoveryService (spec 030)", () => {
  it("keeps present files, downloads missing ones again and flags what the provider cannot return", async () => {
    const files = new Set([`fiscal/${TENANT}/2026/11/old-a.xml`]);
    const { service, rows, states, logs } = setup(
      [doc("a"), doc("b"), doc("c"), doc("d", { status: "CANCELLED", cancelXmlAssetKey: null })],
      files,
      (item) => item.id !== "c"
    );

    const result = await service.run(TENANT);

    expect(result).toEqual({ checked: 4, recovered: 2, missing: 1, nextAfterId: null });
    expect(states.storeFiles).not.toHaveBeenCalledWith(expect.objectContaining({ id: "a" }), expect.anything(), expect.anything());
    expect(rows.get("b")!.xmlAssetKey).toBe(`fiscal/${TENANT}/2026/11/b.xml`);
    expect(rows.get("c")).toMatchObject({ filesMissingReason: "Provedor nao retornou o XML da autorizacao" });
    expect(rows.get("c")!.filesMissingAt).toBeInstanceOf(Date);
    // Cancelled notes need both the authorization and the cancellation XML.
    expect(states.storeFiles).toHaveBeenCalledWith(expect.objectContaining({ id: "d" }), "CANCELLATION", { checkTaxes: false });
    expect(rows.get("d")!.cancelXmlAssetKey).toBe(`fiscal/${TENANT}/2026/11/d-cancelamento.xml`);
    expect(logs.find(([event]) => event === "fiscal.files.missing")?.[1]).toMatchObject({ documentId: "c" });
    expect(logs.find(([event]) => event === "fiscal.files.recovery_completed")?.[1]).toMatchObject({ checked: 4, recovered: 2, missing: 1, hasMore: false });
  });

  it("clears the pending flag once the file is present again", async () => {
    const files = new Set([`fiscal/${TENANT}/2026/11/old-a.xml`]);
    const { service, rows } = setup([doc("a", { filesMissingAt: new Date(), filesMissingReason: "x" })], files, () => true);
    expect(await service.recover(rows.get("a") as never)).toBe("OK");
    expect(rows.get("a")).toMatchObject({ filesMissingAt: null, filesMissingReason: null });
  });

  it("stops at the time budget and continues in a new job from the last document", async () => {
    const { service, jobs } = setup([doc("a"), doc("b")], new Set(), () => true);
    const result = await service.run(TENANT, undefined, Date.now() - 1);
    expect(result).toMatchObject({ checked: 0, nextAfterId: null });

    let calls = 0;
    const deadline = { valueOf: () => (calls++ < 1 ? Number.MAX_SAFE_INTEGER : 0) } as unknown as number;
    const partial = await service.run(TENANT, undefined, deadline);
    expect(partial).toMatchObject({ checked: 1, nextAfterId: "a" });

    await service.request(TENANT, "a");
    expect(jobs.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ type: "FISCAL_FILE_RECOVERY", dedupeKey: `fiscal-file-recovery:${TENANT}:a`, payload: { afterId: "a" } })
    );
  });

  it("stops between notes when the server shuts down, without enqueuing a continuation", async () => {
    const { service, states, jobs } = setup([doc("a"), doc("b")], new Set(), () => true);
    const controller = new AbortController();
    states.storeFiles.mockImplementationOnce(async () => {
      controller.abort();
      return [];
    });

    await expect(service.execute({ tenantId: TENANT, targetId: TENANT, payload: {} }, controller.signal)).rejects.toThrow();
    expect(states.storeFiles).toHaveBeenCalledTimes(1);
    expect(jobs.enqueue).not.toHaveBeenCalled();
  });

  it("treats local storage in production as temporary", () => {
    expect(isTemporaryStorage({ nodeEnv: "production", provider: "local" })).toBe(true);
    expect(isTemporaryStorage({ nodeEnv: "production", provider: undefined })).toBe(true);
    expect(isTemporaryStorage({ nodeEnv: "production", provider: "s3" })).toBe(false);
    expect(isTemporaryStorage({ nodeEnv: "development", provider: "local" })).toBe(false);
  });
});

describe("pending reason FILES_MISSING (spec 030)", () => {
  it("flags authorized and cancelled notes without files, after an unreviewed tax divergence", async () => {
    const { FiscalDocumentsService } = await import("./fiscal-documents.service");
    const service = new FiscalDocumentsService({} as never, { has: () => false } as never, {} as never, {} as never);
    const base = { taxDivergenceAt: null, taxDivergenceReviewedAt: null, filesMissingAt: new Date() };
    expect(service.pendingReason({ ...base, status: "AUTHORIZED" } as never)).toBe("FILES_MISSING");
    expect(service.pendingReason({ ...base, status: "CANCELLED" } as never)).toBe("FILES_MISSING");
    expect(service.pendingReason({ ...base, status: "AUTHORIZED", taxDivergenceAt: new Date() } as never)).toBe("TAX_DIVERGENCE");
    expect(service.pendingReason({ ...base, status: "AUTHORIZED", filesMissingAt: null } as never)).toBeNull();
  });
});
