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
import { logStoreAuditEvent } from "./store-audit";

interface StoreSummary {
  id: string;
  name: string;
  slug: string;
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
  operatingHours: Prisma.JsonValue;
  owner?: StoreResponsibleUser;
}

interface StoreSetupResult {
  store: StoreDetail;
  owner: StoreResponsibleUser;
}

@Injectable()
export class PlatformStoreService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(): Promise<StoreSummary[]> {
    const stores = await this.prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: this.storeRelations,
    });

    return stores.map((store) => ({
      id: store.id,
      name: store.name,
      slug: store.slug,
      active: store.active,
      isOpen: store.isOpen,
      openMode: store.openMode,
      readiness: calculateLaunchReadiness(store),
    }));
  }

  async create(dto: CreateStoreDto, platformUserId: string): Promise<StoreSetupResult> {
    const slug = this.toValidSlug(dto.slug);

    await this.assertSlugAvailable(slug);
    await this.assertOwnerEmailAvailable(dto.owner.email);

    const store = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug,
        phone: dto.phone,
        active: dto.active ?? true,
        isOpen: this.resolveIsOpen(dto.openMode, dto.isOpen ?? false),
        openMode:
          dto.openMode ?? (dto.isOpen ? StoreOpenMode.FORCE_OPEN : StoreOpenMode.FORCE_CLOSED),
        operatingHours: (dto.operatingHours ?? {}) as Prisma.InputJsonValue,
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
      metadata: { slug },
    });

    return {
      store: {
        id: store.id,
        name: store.name,
        slug: store.slug,
        phone: store.phone,
        active: store.active,
        isOpen: store.isOpen,
        openMode: store.openMode,
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

    if (dto.active !== undefined) {
      data.active = dto.active;
      data.deactivatedAt = dto.active ? null : new Date();
    }

    if (dto.slug !== undefined) {
      const slug = this.toValidSlug(dto.slug);
      await this.assertSlugAvailable(slug, storeId);
      data.slug = slug;
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

    return {
      id: store.id,
      name: store.name,
      slug: store.slug,
      phone: store.phone,
      active: store.active,
      isOpen: store.isOpen,
      openMode: store.openMode,
      operatingHours: store.operatingHours,
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
