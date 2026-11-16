import { Inject, Injectable, Logger, OnModuleInit, Optional } from "@nestjs/common";
import type { BackgroundJob } from "@prisma/client";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { BackgroundJobRegistry, RuntimeBackgroundJobHandler } from "../common/background-jobs/background-job.registry";
import { BackgroundJobService } from "../common/background-jobs/background-job.service";
import { imageKey, type ImageKeyPurpose } from "../common/storage/asset-keys";
import { ASSET_STORAGE, AssetStorage } from "../common/storage/asset-storage";
import { decodeLegacyImage } from "../common/storage/image-values";
import { PrismaService } from "../platform/database/prisma.service";

const JOB_TYPE = "LEGACY_IMAGE_MIGRATION" as const;
/** Legacy photos reach 2.1 MB in base64; the migration accepts up to 5 MB decoded. */
export const LEGACY_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const DATA_URL_PREFIX = "data:";

const BRANDING_FIELDS = {
  logoUrl: "BRANDING_LOGO",
  headerImageUrl: "BRANDING_HEADER",
  bodyImageUrl: "BRANDING_BODY",
  footerImageUrl: "BRANDING_FOOTER",
} as const satisfies Record<string, ImageKeyPurpose>;
type BrandingField = keyof typeof BRANDING_FIELDS;

export interface LegacyImageMigrationStatus {
  status: "IDLE" | "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  pending: number;
  migrated: number;
  failed: number;
}

interface MigrationTarget {
  tenantId: string;
  entity: "product" | "branding";
  entityId: string;
  purpose: ImageKeyPurpose;
  value: string;
  /** Conditional update: replaces the value only if it is still the one read. Returns rows updated. */
  replace: (key: string) => Promise<number>;
}

/**
 * Spec 030 (US4): moves the base64 images of products and store branding to the bucket (`images/`)
 * and keeps only the key in the database. One image at a time, to keep memory near two images. Values
 * changed by the user meanwhile are left alone (conditional update) and the file just written is
 * removed. A failure keeps the base64 value and is logged; running again is safe (idempotent).
 */
@Injectable()
export class LegacyImageMigrationService implements OnModuleInit, RuntimeBackgroundJobHandler {
  readonly type = JOB_TYPE;
  readonly policy = { leaseMs: 10 * 60_000, retryBaseDelayMs: 60_000, retryMaxDelayMs: 15 * 60_000 };
  private readonly logger = new Logger("Catalog");

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BackgroundJobService) private readonly jobs: BackgroundJobService,
    @Inject(ASSET_STORAGE) private readonly storage: AssetStorage,
    @Optional() @Inject(BackgroundJobRegistry) private readonly jobRegistry?: BackgroundJobRegistry
  ) {}

  onModuleInit(): void {
    if (this.jobRegistry?.consumerEnabled) this.jobRegistry.register(this);
  }

  /** Idempotent: while a migration of the store is active the same job is returned. */
  async request(tenantId: string): Promise<{ jobId: string; status: "QUEUED" | "RUNNING" }> {
    const job = await this.jobs.enqueue({
      tenantId,
      type: JOB_TYPE,
      priority: "LOW",
      targetType: "TENANT",
      targetId: tenantId,
      dedupeKey: `legacy-image-migration:${tenantId}`,
      maxAttempts: 3,
      payload: {},
    });
    return { jobId: job.id, status: job.status === "RUNNING" ? "RUNNING" : "QUEUED" };
  }

  /** `migrated`: images moved by the last run; `failed`: images still in base64 after a finished run. */
  async status(tenantId: string): Promise<LegacyImageMigrationStatus> {
    const [job, pending] = await Promise.all([
      this.prisma.backgroundJob.findFirst({
        where: { tenantId, type: JOB_TYPE },
        orderBy: { createdAt: "desc" },
        select: { status: true, progressCurrent: true },
      }),
      this.pendingCount(tenantId),
    ]);
    const status: LegacyImageMigrationStatus["status"] = !job
      ? "IDLE"
      : job.status === "SUCCEEDED"
        ? "COMPLETED"
        : job.status === "RUNNING"
          ? "RUNNING"
          : job.status === "FAILED"
            ? "FAILED"
            : "QUEUED";
    return {
      status,
      pending,
      migrated: job?.progressCurrent ?? 0,
      failed: status === "COMPLETED" ? pending : 0,
    };
  }

  async execute(
    job: Pick<BackgroundJob, "tenantId" | "targetId">,
    signal?: AbortSignal
  ): Promise<{ processedCount: number }> {
    const result = await this.run(job.tenantId ?? job.targetId, signal);
    return { processedCount: result.migrated };
  }

  async run(tenantId: string, signal?: AbortSignal): Promise<{ migrated: number; failed: number }> {
    const startedAt = Date.now();
    const counts = { migrated: 0, failed: 0 };
    /** Same content in several branding versions (draft and published) goes to one file. */
    const written = new Map<string, string>();

    let cursor: string | undefined;
    for (;;) {
      signal?.throwIfAborted();
      const next = await this.prisma.product.findFirst({
        where: { tenantId, imageUrl: { startsWith: DATA_URL_PREFIX }, ...(cursor ? { id: { gt: cursor } } : {}) },
        orderBy: { id: "asc" },
        select: { id: true },
      });
      if (!next) break;
      cursor = next.id;
      const row = await this.prisma.product.findUnique({ where: { id: next.id }, select: { imageUrl: true } });
      const value = row?.imageUrl;
      if (!value?.startsWith(DATA_URL_PREFIX)) continue;
      const outcome = await this.migrate(
        {
          tenantId,
          entity: "product",
          entityId: next.id,
          purpose: "PRODUCT_IMAGE",
          value,
          replace: async (key) =>
            (
              await this.prisma.product.updateMany({
                where: { id: next.id, tenantId, imageUrl: value },
                data: { imageUrl: key },
              })
            ).count,
        },
        written
      );
      counts[outcome] += 1;
    }

    const brandingRows = await this.prisma.storeVisualConfiguration.findMany({
      where: {
        tenantId,
        OR: (Object.keys(BRANDING_FIELDS) as BrandingField[]).map((field) => ({
          [field]: { startsWith: DATA_URL_PREFIX },
        })),
      },
      orderBy: { id: "asc" },
      select: { id: true },
    });
    for (const { id } of brandingRows) {
      for (const field of Object.keys(BRANDING_FIELDS) as BrandingField[]) {
        signal?.throwIfAborted();
        const row = await this.prisma.storeVisualConfiguration.findUnique({
          where: { id },
          select: { [field]: true } as Record<BrandingField, boolean>,
        });
        const value = (row as Partial<Record<BrandingField, string | null>> | null)?.[field];
        if (!value?.startsWith(DATA_URL_PREFIX)) continue;
        const outcome = await this.migrate(
          {
            tenantId,
            entity: "branding",
            entityId: id,
            purpose: BRANDING_FIELDS[field],
            value,
            replace: async (key) =>
              (
                await this.prisma.storeVisualConfiguration.updateMany({
                  where: { id, tenantId, [field]: value },
                  data: { [field]: key },
                })
              ).count,
          },
          written
        );
        counts[outcome] += 1;
      }
    }

    this.logger.log(
      JSON.stringify({ event: "catalog.legacy_image.completed", tenantId, ...counts, durationMs: Date.now() - startedAt })
    );
    return counts;
  }

  private async migrate(target: MigrationTarget, written: Map<string, string>): Promise<"migrated" | "failed"> {
    const digest = createHash("sha256").update(target.value).digest("hex");
    const reused = written.get(digest);
    let key = reused;
    let bytes = 0;
    try {
      if (!key) {
        const image = decodeLegacyImage(target.value, LEGACY_IMAGE_MAX_BYTES);
        bytes = image.body.length;
        key = imageKey(target.tenantId, target.purpose, image.extension);
        await this.storage.write({
          key,
          body: Readable.from([image.body]),
          contentType: image.contentType,
          maxBytes: LEGACY_IMAGE_MAX_BYTES,
        });
      }
      const updated = await target.replace(key);
      if (updated === 0) {
        // The user changed the image while it was migrating: keep the new value, drop the copy.
        if (!reused) await this.storage.delete(key).catch(() => undefined);
        return this.failed(target, "Imagem alterada durante a migracao");
      }
      if (!reused) written.set(digest, key);
      this.logger.log(
        JSON.stringify({
          event: "catalog.legacy_image.migrated",
          tenantId: target.tenantId,
          entity: target.entity,
          entityId: target.entityId,
          bytes,
        })
      );
      return "migrated";
    } catch (error) {
      if (key && !reused) await this.storage.delete(key).catch(() => undefined);
      return this.failed(target, (error as Error).message);
    }
  }

  private failed(target: MigrationTarget, reason: string): "failed" {
    this.logger.warn(
      JSON.stringify({
        event: "catalog.legacy_image.failed",
        tenantId: target.tenantId,
        entity: target.entity,
        entityId: target.entityId,
        reason,
      })
    );
    return "failed";
  }

  private async pendingCount(tenantId: string): Promise<number> {
    const [products, branding] = await Promise.all([
      this.prisma.product.count({ where: { tenantId, imageUrl: { startsWith: DATA_URL_PREFIX } } }),
      this.prisma.$queryRaw<Array<{ total: number }>>`
        SELECT COALESCE(SUM(
          (logo_url LIKE 'data:%')::int + (header_image_url LIKE 'data:%')::int +
          (body_image_url LIKE 'data:%')::int + (footer_image_url LIKE 'data:%')::int
        ), 0)::int AS total
        FROM store_visual_configurations
        WHERE tenant_id = ${tenantId}::uuid
      `,
    ]);
    return products + Number(branding[0]?.total ?? 0);
  }
}
