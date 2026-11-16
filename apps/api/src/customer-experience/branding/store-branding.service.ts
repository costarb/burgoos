import { BadRequestException, Inject, Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";
import { NeutralTheme, VisualConfigurationStatus } from "@prisma/client";
import { ASSET_STORAGE, AssetStorage } from "../../common/storage/asset-storage";
import { isStoredAssetKey } from "../../common/storage/asset-keys";
import { isImageDataUrl, normalizeImageReference, resolveImageUrl } from "../../common/storage/image-values";
import { PrismaService } from "../../platform/database/prisma.service";
import { logStoreAuditEvent } from "../../platform/stores/store-audit";
import { assertHexColor, getContrastRatio } from "./color-contrast";
import { DEFAULT_STORE_BRANDING, toPublicBranding } from "./default-branding";
import { StoreBrandingDto } from "./dto/store-branding.dto";
import { BUILT_IN_LAYOUT_PRESETS, isActiveLayoutPreset, toLayoutPresetKey } from "./layout-presets";

type StoreVisualConfigurationDelegate = PrismaService["storeVisualConfiguration"];

const IMAGE_FIELDS = ["logoUrl", "headerImageUrl", "bodyImageUrl", "footerImageUrl"] as const;
type ImageField = (typeof IMAGE_FIELDS)[number];
type ImageValues = Partial<Record<ImageField, string | null>>;
const IMAGE_LABELS: Record<ImageField, string> = {
  logoUrl: "Logo",
  headerImageUrl: "Imagem de header",
  bodyImageUrl: "Imagem de body",
  footerImageUrl: "Imagem de footer",
};

@Injectable()
export class StoreBrandingService {
  private readonly logger = new Logger(StoreBrandingService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(ASSET_STORAGE) private readonly assetStorage?: AssetStorage
  ) {}

  async getState(tenantId: string) {
    const [draft, published, availableLayouts] = await Promise.all([
      this.prisma.storeVisualConfiguration.findFirst({
        where: { tenantId, status: VisualConfigurationStatus.DRAFT },
        orderBy: { updatedAt: "desc" },
      }),
      this.prisma.storeVisualConfiguration.findFirst({
        where: { tenantId, status: VisualConfigurationStatus.PUBLISHED },
        orderBy: { publishedAt: "desc" },
      }),
      this.getAvailableLayouts(),
    ]);

    return {
      draft: draft ? await this.toView(draft) : null,
      published: published ? await this.toView(published) : null,
      availableLayouts,
    };
  }

  async saveDraft(tenantId: string, userId: string, dto: StoreBrandingDto) {
    const existingDraft = await this.prisma.storeVisualConfiguration.findFirst({
      where: { tenantId, status: VisualConfigurationStatus.DRAFT },
      orderBy: { updatedAt: "desc" },
    });
    const data = await this.toValidatedData(tenantId, dto, await this.currentImageValues(tenantId));

    const configuration = existingDraft
      ? await this.prisma.storeVisualConfiguration.update({
          where: { id: existingDraft.id },
          data,
        })
      : await this.prisma.storeVisualConfiguration.create({
          data: {
            tenantId,
            status: VisualConfigurationStatus.DRAFT,
            createdByUserId: userId,
            ...data,
          },
        });

    if (existingDraft) await this.deleteReplacedImages(tenantId, existingDraft, data);
    return this.toView(configuration);
  }

  async preview(tenantId: string, dto: StoreBrandingDto) {
    const data = await this.toValidatedData(tenantId, dto, await this.currentImageValues(tenantId));

    return {
      safeToPublish: true,
      warnings: [],
      configuration: {
        id: "preview",
        status: VisualConfigurationStatus.DRAFT,
        logoUrl: await resolveImageUrl(this.assetStorage, data.logoUrl),
        headerImageUrl: await resolveImageUrl(this.assetStorage, data.headerImageUrl),
        bodyImageUrl: await resolveImageUrl(this.assetStorage, data.bodyImageUrl),
        footerImageUrl: await resolveImageUrl(this.assetStorage, data.footerImageUrl),
        ...this.assetKeys(data),
        primaryColor: data.primaryColor,
        accentColor: data.accentColor,
        neutralTheme: data.neutralTheme,
        layoutPreset: data.layoutPresetKey,
        showProductImages: data.showProductImages,
        showProductDescriptions: data.showProductDescriptions,
        orderingEnabled: data.orderingEnabled,
        publishedAt: null,
      },
    };
  }

  async publishDraft(tenantId: string, userId: string) {
    const draft = await this.prisma.storeVisualConfiguration.findFirst({
      where: { tenantId, status: VisualConfigurationStatus.DRAFT },
      orderBy: { updatedAt: "desc" },
    });

    if (!draft) {
      throw new BadRequestException("Nao existe rascunho para publicar");
    }

    await this.prisma.storeVisualConfiguration.updateMany({
      where: { tenantId, status: VisualConfigurationStatus.PUBLISHED },
      data: { status: VisualConfigurationStatus.ARCHIVED },
    });

    const published = await this.prisma.storeVisualConfiguration.update({
      where: { id: draft.id },
      data: {
        status: VisualConfigurationStatus.PUBLISHED,
        publishedByUserId: userId,
        publishedAt: new Date(),
      },
    });

    logStoreAuditEvent({
      action: "BRANDING_PUBLISHED",
      tenantId,
      userId,
      metadata: { configurationId: published.id },
    });

    return this.toView(published);
  }

  async history(tenantId: string) {
    const configurations = await this.prisma.storeVisualConfiguration.findMany({
      where: {
        tenantId,
        status: {
          in: [VisualConfigurationStatus.PUBLISHED, VisualConfigurationStatus.ARCHIVED],
        },
      },
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    });

    return Promise.all(configurations.map((configuration) => this.toView(configuration)));
  }

  async restorePrevious(tenantId: string, userId: string) {
    const previous = await this.prisma.storeVisualConfiguration.findFirst({
      where: { tenantId, status: VisualConfigurationStatus.ARCHIVED },
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    });

    if (!previous) {
      throw new NotFoundException("Nao existe configuracao anterior para restaurar");
    }

    await this.prisma.storeVisualConfiguration.updateMany({
      where: { tenantId, status: VisualConfigurationStatus.PUBLISHED },
      data: { status: VisualConfigurationStatus.ARCHIVED },
    });

    const restored = await this.prisma.storeVisualConfiguration.update({
      where: { id: previous.id },
      data: {
        status: VisualConfigurationStatus.PUBLISHED,
        publishedByUserId: userId,
        publishedAt: new Date(),
      },
    });

    logStoreAuditEvent({
      action: "BRANDING_RESTORED",
      tenantId,
      userId,
      metadata: { configurationId: restored.id },
    });

    return this.toView(restored);
  }

  async getPublicBranding(tenantId: string) {
    const storeVisualConfiguration = (
      this.prisma as PrismaService & {
        storeVisualConfiguration?: StoreVisualConfigurationDelegate;
      }
    ).storeVisualConfiguration;

    if (!storeVisualConfiguration) {
      return DEFAULT_STORE_BRANDING;
    }

    const published = await storeVisualConfiguration.findFirst({
      where: { tenantId, status: VisualConfigurationStatus.PUBLISHED },
      orderBy: { publishedAt: "desc" },
    });

    return toPublicBranding(published);
  }

  async getPublicBrandingForMenu(tenantId: string, assetBaseUrl: string | null, slug: string) {
    const storeVisualConfiguration = (
      this.prisma as PrismaService & {
        storeVisualConfiguration?: StoreVisualConfigurationDelegate;
      }
    ).storeVisualConfiguration;

    if (!storeVisualConfiguration) {
      return DEFAULT_STORE_BRANDING;
    }

    const published = await storeVisualConfiguration.findFirst({
      where: { tenantId, status: VisualConfigurationStatus.PUBLISHED },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        primaryColor: true,
        accentColor: true,
        neutralTheme: true,
        layoutPresetKey: true,
        showProductImages: true,
        showProductDescriptions: true,
        orderingEnabled: true,
      },
    });

    if (!published) {
      return DEFAULT_STORE_BRANDING;
    }

    const [assets] = await this.prisma.$queryRaw<
      Array<{
        hasLogoUrl: boolean;
        hasHeaderImageUrl: boolean;
        hasBodyImageUrl: boolean;
        hasFooterImageUrl: boolean;
      }>
    >`
      SELECT
        logo_url IS NOT NULL AS "hasLogoUrl",
        header_image_url IS NOT NULL AS "hasHeaderImageUrl",
        body_image_url IS NOT NULL AS "hasBodyImageUrl",
        footer_image_url IS NOT NULL AS "hasFooterImageUrl"
      FROM store_visual_configurations
      WHERE id = ${published.id}::uuid
      LIMIT 1
    `;

    const branding = toPublicBranding({
      ...published,
      logoUrl: null,
      headerImageUrl: null,
      bodyImageUrl: null,
      footerImageUrl: null,
    });

    if (!assetBaseUrl || !assets) {
      return branding;
    }

    return {
      ...branding,
      logoUrl: assets.hasLogoUrl
        ? `${assetBaseUrl}/api/public/tenants/${slug}/branding/logo`
        : null,
      headerImageUrl: assets.hasHeaderImageUrl
        ? `${assetBaseUrl}/api/public/tenants/${slug}/branding/header`
        : null,
      bodyImageUrl: assets.hasBodyImageUrl
        ? `${assetBaseUrl}/api/public/tenants/${slug}/branding/body`
        : null,
      footerImageUrl: assets.hasFooterImageUrl
        ? `${assetBaseUrl}/api/public/tenants/${slug}/branding/footer`
        : null,
    };
  }

  getDefaultBranding() {
    return DEFAULT_STORE_BRANDING;
  }

  async getAvailableLayouts() {
    const databasePresets = await this.prisma.layoutPreset.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });

    return databasePresets.length > 0 ? databasePresets : BUILT_IN_LAYOUT_PRESETS;
  }

  private async toValidatedData(tenantId: string, dto: StoreBrandingDto, currentImages: string[]) {
    let primaryColor: string;
    let accentColor: string;

    try {
      primaryColor = assertHexColor(dto.primaryColor, "Cor principal");
      accentColor = assertHexColor(dto.accentColor, "Cor de destaque");
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Cor invalida");
    }

    if (getContrastRatio(primaryColor, accentColor) < 1.5) {
      throw new BadRequestException("Cores principal e de destaque precisam ser distinguiveis");
    }

    const layoutPreset = await this.findActiveLayoutPreset(dto.layoutPreset);

    if (!layoutPreset) {
      throw new NotFoundException("Layout nao encontrado ou inativo");
    }

    return {
      logoUrl: this.normalizeImage(tenantId, dto.logoUrl, "logoUrl", currentImages),
      headerImageUrl: this.normalizeImage(tenantId, dto.headerImageUrl, "headerImageUrl", currentImages),
      bodyImageUrl: this.normalizeImage(tenantId, dto.bodyImageUrl, "bodyImageUrl", currentImages),
      footerImageUrl: this.normalizeImage(tenantId, dto.footerImageUrl, "footerImageUrl", currentImages),
      primaryColor,
      accentColor,
      neutralTheme: dto.neutralTheme as NeutralTheme,
      layoutPresetKey: toLayoutPresetKey(dto.layoutPreset),
      showProductImages: dto.showProductImages ?? DEFAULT_STORE_BRANDING.showProductImages,
      showProductDescriptions:
        dto.showProductDescriptions ?? DEFAULT_STORE_BRANDING.showProductDescriptions,
      orderingEnabled: dto.orderingEnabled ?? DEFAULT_STORE_BRANDING.orderingEnabled,
    };
  }

  private async findActiveLayoutPreset(key: string) {
    const layoutPreset = await this.prisma.layoutPreset.findUnique({
      where: { key },
    });

    if (layoutPreset?.active) {
      return layoutPreset;
    }

    return isActiveLayoutPreset(key) ? { key, active: true } : null;
  }

  private normalizeImage(
    tenantId: string,
    value: string | null | undefined,
    field: ImageField,
    current: string[]
  ): string | null {
    return normalizeImageReference(value ?? null, { tenantId, label: IMAGE_LABELS[field], current }) ?? null;
  }

  /** Images of the draft and of the published version: the only legacy base64 values a save may keep. */
  private async currentImageValues(tenantId: string): Promise<string[]> {
    const rows = await this.prisma.storeVisualConfiguration.findMany({
      where: {
        tenantId,
        status: { in: [VisualConfigurationStatus.DRAFT, VisualConfigurationStatus.PUBLISHED] },
      },
      select: { logoUrl: true, headerImageUrl: true, bodyImageUrl: true, footerImageUrl: true },
    });
    return rows
      .flatMap((row) => IMAGE_FIELDS.map((field) => row[field]))
      .filter((value): value is string => Boolean(value));
  }

  /**
   * FR-020: removes from the bucket the draft images replaced by this save. Published and archived
   * versions may point to the same key (restore), so a key is removed only when no version uses it.
   */
  private async deleteReplacedImages(tenantId: string, previous: ImageValues, next: ImageValues) {
    if (!this.assetStorage) return;
    for (const field of IMAGE_FIELDS) {
      const key = previous[field];
      if (!key || key === next[field] || !isStoredAssetKey(key)) continue;
      try {
        const stillUsed = await this.prisma.storeVisualConfiguration.count({
          where: { tenantId, OR: IMAGE_FIELDS.map((candidate) => ({ [candidate]: key })) },
        });
        if (stillUsed === 0) await this.assetStorage.delete(key);
      } catch (error) {
        this.logger.warn(`branding.image.delete_failed tenantId=${tenantId} reason=${(error as Error).message}`);
      }
    }
  }

  /** Stored key or URL of each image (the form sends it back); legacy base64 is not repeated. */
  private assetKeys(values: ImageValues) {
    const keyOf = (value: string | null | undefined) => (value && !isImageDataUrl(value) ? value : null);
    return {
      logoAssetKey: keyOf(values.logoUrl),
      headerImageAssetKey: keyOf(values.headerImageUrl),
      bodyImageAssetKey: keyOf(values.bodyImageUrl),
      footerImageAssetKey: keyOf(values.footerImageUrl),
    };
  }

  private async toView(configuration: {
    id: string;
    status: VisualConfigurationStatus | string;
    logoUrl: string | null;
    headerImageUrl?: string | null;
    bodyImageUrl?: string | null;
    footerImageUrl?: string | null;
    primaryColor: string;
    accentColor: string;
    neutralTheme: NeutralTheme | string;
    layoutPresetKey: string;
    showProductImages?: boolean;
    showProductDescriptions?: boolean;
    orderingEnabled?: boolean;
    publishedAt: Date | string | null;
  }) {
    const images = {
      logoUrl: configuration.logoUrl,
      headerImageUrl: configuration.headerImageUrl ?? DEFAULT_STORE_BRANDING.headerImageUrl,
      bodyImageUrl: configuration.bodyImageUrl ?? DEFAULT_STORE_BRANDING.bodyImageUrl,
      footerImageUrl: configuration.footerImageUrl ?? DEFAULT_STORE_BRANDING.footerImageUrl,
    };
    return {
      id: configuration.id,
      status: configuration.status,
      logoUrl: await resolveImageUrl(this.assetStorage, images.logoUrl),
      headerImageUrl: await resolveImageUrl(this.assetStorage, images.headerImageUrl),
      bodyImageUrl: await resolveImageUrl(this.assetStorage, images.bodyImageUrl),
      footerImageUrl: await resolveImageUrl(this.assetStorage, images.footerImageUrl),
      ...this.assetKeys(images),
      primaryColor: configuration.primaryColor,
      accentColor: configuration.accentColor,
      neutralTheme: configuration.neutralTheme,
      layoutPreset: configuration.layoutPresetKey,
      showProductImages:
        configuration.showProductImages ?? DEFAULT_STORE_BRANDING.showProductImages,
      showProductDescriptions:
        configuration.showProductDescriptions ?? DEFAULT_STORE_BRANDING.showProductDescriptions,
      orderingEnabled: configuration.orderingEnabled ?? DEFAULT_STORE_BRANDING.orderingEnabled,
      publishedAt:
        configuration.publishedAt instanceof Date
          ? configuration.publishedAt.toISOString()
          : configuration.publishedAt,
    };
  }
}
