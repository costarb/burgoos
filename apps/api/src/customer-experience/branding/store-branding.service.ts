import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { NeutralTheme, VisualConfigurationStatus } from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";
import { logStoreAuditEvent } from "../../platform/stores/store-audit";
import { assertHexColor, getContrastRatio } from "./color-contrast";
import { DEFAULT_STORE_BRANDING, toPublicBranding } from "./default-branding";
import { StoreBrandingDto } from "./dto/store-branding.dto";
import { BUILT_IN_LAYOUT_PRESETS, isActiveLayoutPreset, toLayoutPresetKey } from "./layout-presets";

type StoreVisualConfigurationDelegate = PrismaService["storeVisualConfiguration"];

@Injectable()
export class StoreBrandingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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
      draft: draft ? this.toView(draft) : null,
      published: published ? this.toView(published) : null,
      availableLayouts,
    };
  }

  async saveDraft(tenantId: string, userId: string, dto: StoreBrandingDto) {
    const data = await this.toValidatedData(dto);
    const existingDraft = await this.prisma.storeVisualConfiguration.findFirst({
      where: { tenantId, status: VisualConfigurationStatus.DRAFT },
      orderBy: { updatedAt: "desc" },
    });

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

    return this.toView(configuration);
  }

  async preview(tenantId: string, dto: StoreBrandingDto) {
    const data = await this.toValidatedData(dto);

    return {
      safeToPublish: true,
      warnings: [],
      configuration: {
        id: "preview",
        status: VisualConfigurationStatus.DRAFT,
        logoUrl: data.logoUrl,
        primaryColor: data.primaryColor,
        accentColor: data.accentColor,
        neutralTheme: data.neutralTheme,
        layoutPreset: data.layoutPresetKey,
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

    return configurations.map((configuration) => this.toView(configuration));
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

  private async toValidatedData(dto: StoreBrandingDto) {
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
      logoUrl: dto.logoUrl ?? null,
      primaryColor,
      accentColor,
      neutralTheme: dto.neutralTheme as NeutralTheme,
      layoutPresetKey: toLayoutPresetKey(dto.layoutPreset),
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

  private toView(configuration: {
    id: string;
    status: VisualConfigurationStatus | string;
    logoUrl: string | null;
    primaryColor: string;
    accentColor: string;
    neutralTheme: NeutralTheme | string;
    layoutPresetKey: string;
    publishedAt: Date | string | null;
  }) {
    return {
      id: configuration.id,
      status: configuration.status,
      logoUrl: configuration.logoUrl,
      primaryColor: configuration.primaryColor,
      accentColor: configuration.accentColor,
      neutralTheme: configuration.neutralTheme,
      layoutPreset: configuration.layoutPresetKey,
      publishedAt:
        configuration.publishedAt instanceof Date
          ? configuration.publishedAt.toISOString()
          : configuration.publishedAt,
    };
  }
}
