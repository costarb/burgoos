import { describe, expect, it, vi } from "vitest";
import type { Readable } from "node:stream";
import { LegacyImageMigrationService } from "../src/catalog/legacy-image-migration.service";

const tenantId = "11111111-1111-4111-8111-111111111111";
const otherTenant = "99999999-9999-4999-8999-999999999999";
const png = (bytes: string) => `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;

type Row = Record<string, string | null> & { id: string; tenantId: string };
type Where = Record<string, unknown> & { OR?: Array<Record<string, unknown>> };

function matches(row: Row, where: Where): boolean {
  return Object.entries(where).every(([field, condition]) => {
    if (field === "OR") return (condition as Where[]).some((part) => matches(row, part));
    if (condition && typeof condition === "object") {
      const { startsWith, gt } = condition as { startsWith?: string; gt?: string };
      if (startsWith !== undefined) return String(row[field] ?? "").startsWith(startsWith);
      if (gt !== undefined) return String(row[field]) > gt;
    }
    return row[field] === condition;
  });
}

function table(rows: Row[]) {
  return {
    rows,
    findFirst: vi.fn(async ({ where }: { where: Where }) =>
      [...rows].sort((a, b) => a.id.localeCompare(b.id)).find((row) => matches(row, where)) ?? null
    ),
    findMany: vi.fn(async ({ where }: { where: Where }) => rows.filter((row) => matches(row, where))),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => rows.find((row) => row.id === where.id) ?? null),
    updateMany: vi.fn(async ({ where, data }: { where: Where; data: Record<string, string> }) => {
      const hits = rows.filter((row) => matches(row, where));
      hits.forEach((row) => Object.assign(row, data));
      return { count: hits.length };
    }),
    count: vi.fn(async ({ where }: { where: Where }) => rows.filter((row) => matches(row, where)).length),
  };
}

function setup(products: Row[], branding: Row[] = []) {
  const prisma = {
    product: table(products),
    storeVisualConfiguration: table(branding),
    backgroundJob: { findFirst: vi.fn(async () => null) },
    $queryRaw: vi.fn(async () => [{ total: 0 }]),
  };
  const files = new Map<string, Buffer>();
  const storage = {
    write: vi.fn(async ({ key, body }: { key: string; body: Readable }) => {
      const chunks: Buffer[] = [];
      for await (const chunk of body) chunks.push(Buffer.from(chunk));
      files.set(key, Buffer.concat(chunks));
      return { sizeBytes: files.get(key)!.length };
    }),
    delete: vi.fn(async (key: string) => void files.delete(key)),
  };
  const jobs = { enqueue: vi.fn(async () => ({ id: "job-1", status: "QUEUED" })) };
  const service = new LegacyImageMigrationService(prisma as never, jobs as never, storage as never);
  return { prisma, storage, files, jobs, service };
}

describe("legacy image migration (spec 030, US4)", () => {
  it("moves product and branding base64 to images/ and keeps only keys, one file per distinct content", async () => {
    const header = png("header-bytes");
    const { prisma, files, service } = setup(
      [
        { id: "p1", tenantId, imageUrl: png("photo-1") },
        { id: "p2", tenantId, imageUrl: `images/${tenantId}/product/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png` },
        { id: "p3", tenantId, imageUrl: "https://cdn.example/x.png" },
        { id: "p4", tenantId: otherTenant, imageUrl: png("other-store") },
      ],
      [
        { id: "b1", tenantId, logoUrl: null, headerImageUrl: header, bodyImageUrl: null, footerImageUrl: null },
        { id: "b2", tenantId, logoUrl: null, headerImageUrl: header, bodyImageUrl: null, footerImageUrl: null },
      ]
    );

    const result = await service.run(tenantId);

    expect(result).toEqual({ migrated: 3, failed: 0 });
    const p1 = prisma.product.rows[0].imageUrl!;
    expect(p1).toMatch(new RegExp(`^images/${tenantId}/product/[a-f0-9-]+\\.png$`));
    expect(files.get(p1)?.toString()).toBe("photo-1");
    expect(prisma.product.rows[3].imageUrl).toBe(png("other-store"));
    const [b1, b2] = prisma.storeVisualConfiguration.rows;
    expect(b1.headerImageUrl).toMatch(new RegExp(`^images/${tenantId}/branding-header/`));
    expect(b2.headerImageUrl).toBe(b1.headerImageUrl);
    expect(files.size).toBe(2);

    // Idempotent: a second run finds nothing to move.
    expect(await service.run(tenantId)).toEqual({ migrated: 0, failed: 0 });
  });

  it("keeps the base64 value when it cannot be decoded and leaves no file behind", async () => {
    const { prisma, files, service } = setup([
      { id: "p1", tenantId, imageUrl: "data:image/gif;base64,R0lGOD" },
      { id: "p2", tenantId, imageUrl: "data:image/png;base64,***" },
    ]);

    expect(await service.run(tenantId)).toEqual({ migrated: 0, failed: 2 });
    expect(prisma.product.rows.map((row) => row.imageUrl)).toEqual([
      "data:image/gif;base64,R0lGOD",
      "data:image/png;base64,***",
    ]);
    expect(files.size).toBe(0);
  });

  it("does not overwrite an image changed by the user during the migration", async () => {
    const { prisma, storage, files, service } = setup([{ id: "p1", tenantId, imageUrl: png("old") }]);
    const userKey = `images/${tenantId}/product/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp`;
    storage.write.mockImplementationOnce(async ({ key }: { key: string }) => {
      files.set(key, Buffer.from("old"));
      prisma.product.rows[0].imageUrl = userKey; // saved from the admin meanwhile
      return { sizeBytes: 3 };
    });

    expect(await service.run(tenantId)).toEqual({ migrated: 0, failed: 1 });
    expect(prisma.product.rows[0].imageUrl).toBe(userKey);
    expect(files.size).toBe(0);
  });

  it("reports what is still in base64 after a finished run as failed", async () => {
    const { prisma, service } = setup([{ id: "p1", tenantId, imageUrl: "data:image/gif;base64,R0lGOD" }]);
    prisma.backgroundJob.findFirst.mockResolvedValue({ status: "SUCCEEDED", progressCurrent: 35 } as never);
    prisma.$queryRaw.mockResolvedValue([{ total: 1 }]);

    expect(await service.status(tenantId)).toEqual({ status: "COMPLETED", pending: 2, migrated: 35, failed: 2 });
  });

  it("enqueues one job per store", async () => {
    const { jobs, service } = setup([]);
    await expect(service.request(tenantId)).resolves.toEqual({ jobId: "job-1", status: "QUEUED" });
    expect(jobs.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ type: "LEGACY_IMAGE_MIGRATION", dedupeKey: `legacy-image-migration:${tenantId}`, tenantId })
    );
  });
});
