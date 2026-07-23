import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, StoreOpenMode, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";
import { PrismaService } from "../database/prisma.service";
import { CreateStoreDto, UpdateStoreDto } from "./dto/store-onboarding.dto";
import { calculateLaunchReadiness, LaunchReadiness } from "./launch-readiness";
import { assertValidStoreSlug } from "./store-slug";
import { normalizeStoreDomain } from "./store-domain";
import { logStoreAuditEvent } from "./store-audit";

interface StoreSummary {
  id: string;
  name: string;
  slug: string;
  publicDomain?: string | null;
  publicMenuUrl?: string | null;
  phone?: string;
  city?: string | null;
  state?: string | null;
  active: boolean;
  isOpen: boolean;
  openMode: StoreOpenMode;
  readiness?: LaunchReadiness;
}

interface StoreResponsibleUser {
  id: string;
  name: string;
  email: string;
}

interface StoreDetail extends StoreSummary {
  phone: string;
  address?: StoreAddress | null;
  socialLinks?: StoreSocialLinks | null;
  operatingHours: Prisma.JsonValue;
  owner?: StoreResponsibleUser;
}

interface StoreSetupResult {
  store: StoreDetail;
  owner: StoreResponsibleUser;
}

interface StoreFilters {
  search?: string;
  active?: boolean;
}

interface StoreAddress {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

interface StoreSocialLinks {
  instagram?: string;
  facebook?: string;
  whatsapp?: string;
  website?: string;
}

interface StoreProfile {
  address: StoreAddress | null;
  socialLinks: StoreSocialLinks | null;
}

@Injectable()
export class PlatformStoreService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(filters: StoreFilters = {}): Promise<StoreSummary[]> {
    const stores = await this.prisma.tenant.findMany({
      where: {
        active: filters.active,
        OR: filters.search
          ? [
              { name: { contains: filters.search, mode: "insensitive" } },
              { slug: { contains: filters.search, mode: "insensitive" } },
              { publicDomain: { contains: filters.search, mode: "insensitive" } },
              { phone: { contains: filters.search, mode: "insensitive" } },
            ]
          : undefined,
      },
      orderBy: { createdAt: "desc" },
      include: this.storeRelations,
    });

    return stores.map((store) => {
      const profile = this.readStoreProfile(store.config);

      return {
        id: store.id,
        name: store.name,
        slug: store.slug,
        publicDomain: store.publicDomain,
        publicMenuUrl: this.publicMenuUrl(store.publicDomain),
        phone: store.phone,
        city: profile.address?.city ?? null,
        state: profile.address?.state ?? null,
        active: store.active,
        isOpen: store.isOpen,
        openMode: store.openMode,
        readiness: calculateLaunchReadiness(store),
      };
    });
  }

  async create(dto: CreateStoreDto, platformUserId: string): Promise<StoreSetupResult> {
    const slug = this.toValidSlug(dto.slug);
    const publicDomain = dto.publicDomain ? this.toValidDomain(dto.publicDomain) : null;

    await this.assertSlugAvailable(slug);
    if (publicDomain) await this.assertDomainAvailable(publicDomain);
    await this.assertOwnerEmailAvailable(dto.owner.email);

    const store = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug,
        publicDomain,
        phone: dto.phone,
        active: dto.active ?? true,
        isOpen: this.resolveIsOpen(dto.openMode, dto.isOpen ?? false),
        openMode:
          dto.openMode ?? (dto.isOpen ? StoreOpenMode.FORCE_OPEN : StoreOpenMode.FORCE_CLOSED),
        operatingHours: (dto.operatingHours ?? {}) as Prisma.InputJsonValue,
        config: this.mergeStoreProfile({}, dto.address, dto.socialLinks),
        setupCompletedAt: new Date(),
        createdByPlatformUserId: platformUserId,
        defaultLayoutPresetKey: "classic",
      },
    });

    const owner = await this.prisma.user.create({
      data: {
        tenantId: store.id,
        role: UserRole.OWNER,
        name: dto.owner.name,
        email: dto.owner.email,
        passwordHash: await hash(dto.owner.temporaryPassword, 10),
      },
    });

    logStoreAuditEvent({
      action: "STORE_CREATED",
      tenantId: store.id,
      platformUserId,
      metadata: { slug, publicDomain },
    });

    return {
      store: {
        id: store.id,
        name: store.name,
        slug: store.slug,
        publicDomain: store.publicDomain,
        publicMenuUrl: this.publicMenuUrl(store.publicDomain),
        phone: store.phone,
        active: store.active,
        isOpen: store.isOpen,
        openMode: store.openMode,
        address: this.readStoreProfile(store.config).address,
        socialLinks: this.readStoreProfile(store.config).socialLinks,
        operatingHours: store.operatingHours,
        owner: {
          id: owner.id,
          name: owner.name,
          email: owner.email,
        },
      },
      owner: {
        id: owner.id,
        name: owner.name,
        email: owner.email,
      },
    };
  }

  async get(storeId: string): Promise<StoreDetail> {
    const store = await this.findStore(storeId);
    return this.toDetail(store);
  }

  async update(storeId: string, dto: UpdateStoreDto, platformUserId: string): Promise<StoreDetail> {
    const data: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      data.name = dto.name;
    }

    if (dto.phone !== undefined) {
      data.phone = dto.phone;
    }

    if (dto.isOpen !== undefined) {
      data.isOpen = dto.isOpen;
    }

    if (dto.openMode !== undefined) {
      data.openMode = dto.openMode;
      data.isOpen = this.resolveIsOpen(dto.openMode, dto.isOpen);
    }

    if (dto.operatingHours !== undefined) {
      data.operatingHours = dto.operatingHours as Prisma.InputJsonValue;
    }

    if (dto.address !== undefined || dto.socialLinks !== undefined) {
      const current = await this.prisma.tenant.findUnique({
        where: { id: storeId },
        select: { config: true },
      });

      if (!current) {
        throw new NotFoundException("Loja nao encontrada");
      }

      data.config = this.mergeStoreProfile(current.config, dto.address, dto.socialLinks);
    }

    if (dto.active !== undefined) {
      data.active = dto.active;
      data.deactivatedAt = dto.active ? null : new Date();
    }

    if (dto.slug !== undefined) {
      const slug = this.toValidSlug(dto.slug);
      await this.assertSlugAvailable(slug, storeId);
      data.slug = slug;
    }

    if (dto.publicDomain !== undefined) {
      const publicDomain = dto.publicDomain?.trim()
        ? this.toValidDomain(dto.publicDomain)
        : null;
      if (publicDomain) await this.assertDomainAvailable(publicDomain, storeId);
      data.publicDomain = publicDomain;
    }

    const store = await this.prisma.tenant.update({
      where: { id: storeId },
      data,
      include: this.storeRelations,
    });

    logStoreAuditEvent({
      action: "STORE_UPDATED",
      tenantId: storeId,
      platformUserId,
      metadata: data,
    });

    return this.toDetail(store);
  }

  async readiness(storeId: string): Promise<LaunchReadiness> {
    const store = await this.findStore(storeId);
    return calculateLaunchReadiness(store);
  }

  private async findStore(storeId: string) {
    const store = await this.prisma.tenant.findFirst({
      where: { id: storeId },
      include: this.storeRelations,
    });

    if (!store) {
      throw new NotFoundException("Loja nao encontrada");
    }

    return store;
  }

  private toDetail(store: Awaited<ReturnType<PlatformStoreService["findStore"]>>): StoreDetail {
    const owner = store.users.find((user) => user.role === UserRole.OWNER);
    const profile = this.readStoreProfile(store.config);

    return {
      id: store.id,
      name: store.name,
      slug: store.slug,
      publicDomain: store.publicDomain,
      publicMenuUrl: this.publicMenuUrl(store.publicDomain),
      phone: store.phone,
      city: profile.address?.city ?? null,
      state: profile.address?.state ?? null,
      active: store.active,
      isOpen: store.isOpen,
      openMode: store.openMode,
      operatingHours: store.operatingHours,
      address: profile.address,
      socialLinks: profile.socialLinks,
      owner: owner
        ? {
            id: owner.id,
            name: owner.name,
            email: owner.email,
          }
        : undefined,
      readiness: calculateLaunchReadiness(store),
    };
  }

  private toValidSlug(value: string): string {
    try {
      return assertValidStoreSlug(value);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Slug invalido");
    }
  }

  private async assertSlugAvailable(slug: string, currentStoreId?: string): Promise<void> {
    const existing = await this.prisma.tenant.findUnique({
      where: { slug },
    });

    if (existing && existing.id !== currentStoreId) {
      throw new ConflictException("Slug ja esta em uso");
    }
  }

  private toValidDomain(value: string): string {
    try {
      return normalizeStoreDomain(value);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Dominio invalido");
    }
  }

  private async assertDomainAvailable(domain: string, currentStoreId?: string): Promise<void> {
    const existing = await this.prisma.tenant.findUnique({ where: { publicDomain: domain } });
    if (existing && existing.id !== currentStoreId) {
      throw new ConflictException("Dominio ja esta em uso");
    }
  }

  private publicMenuUrl(domain: string | null): string | null {
    return domain ? `https://${domain}/cardapio` : null;
  }

  private async assertOwnerEmailAvailable(email: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new ConflictException("E-mail do responsavel ja esta em uso");
    }
  }

  private resolveIsOpen(openMode?: StoreOpenMode | string, fallback = false): boolean {
    if (openMode === StoreOpenMode.FORCE_OPEN) {
      return true;
    }

    if (openMode === StoreOpenMode.FORCE_CLOSED) {
      return false;
    }

    return fallback;
  }

  private mergeStoreProfile(
    config: Prisma.JsonValue,
    address: CreateStoreDto["address"] | UpdateStoreDto["address"] | undefined,
    socialLinks: CreateStoreDto["socialLinks"] | UpdateStoreDto["socialLinks"] | undefined
  ): Prisma.InputJsonValue {
    const normalizedConfig = this.toConfigObject(config);
    const currentProfile = this.readStoreProfile(config);
    const nextAddress =
      address === undefined ? currentProfile.address : this.normalizeAddress(address);
    const nextSocialLinks =
      socialLinks === undefined
        ? currentProfile.socialLinks
        : this.normalizeSocialLinks(socialLinks);

    return {
      ...normalizedConfig,
      storeProfile: {
        address: nextAddress,
        socialLinks: nextSocialLinks,
      },
    } as Prisma.InputJsonValue;
  }

  private readStoreProfile(config: Prisma.JsonValue): StoreProfile {
    const root = this.toConfigObject(config);
    const profile =
      typeof root.storeProfile === "object" && root.storeProfile !== null
        ? (root.storeProfile as Record<string, unknown>)
        : {};

    return {
      address: this.normalizeAddress(profile.address as StoreAddress | undefined),
      socialLinks: this.normalizeSocialLinks(profile.socialLinks as StoreSocialLinks | undefined),
    };
  }

  private normalizeAddress(address: StoreAddress | null | undefined): StoreAddress | null {
    if (!address || typeof address !== "object") {
      return null;
    }

    const normalized = {
      street: this.cleanText(address.street),
      number: this.cleanText(address.number),
      complement: this.cleanText(address.complement),
      neighborhood: this.cleanText(address.neighborhood),
      city: this.cleanText(address.city),
      state: this.cleanText(address.state)?.toUpperCase(),
      postalCode: this.cleanText(address.postalCode),
    };

    return this.withoutEmptyValues(normalized);
  }

  private normalizeSocialLinks(
    socialLinks: StoreSocialLinks | null | undefined
  ): StoreSocialLinks | null {
    if (!socialLinks || typeof socialLinks !== "object") {
      return null;
    }

    const normalized = {
      instagram: this.cleanText(socialLinks.instagram),
      facebook: this.cleanText(socialLinks.facebook),
      whatsapp: this.cleanText(socialLinks.whatsapp),
      website: this.cleanText(socialLinks.website),
    };

    return this.withoutEmptyValues(normalized);
  }

  private withoutEmptyValues<T extends Record<string, string | undefined>>(value: T): T | null {
    const entries = Object.entries(value).filter(([, field]) => Boolean(field));

    return entries.length > 0 ? (Object.fromEntries(entries) as T) : null;
  }

  private cleanText(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private toConfigObject(config: Prisma.JsonValue): Record<string, unknown> {
    return typeof config === "object" && config !== null && !Array.isArray(config)
      ? { ...(config as Record<string, unknown>) }
      : {};
  }

  private readonly storeRelations = {
    users: {
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    },
    visualConfigurations: {
      select: {
        status: true,
      },
    },
  } as const;
}
