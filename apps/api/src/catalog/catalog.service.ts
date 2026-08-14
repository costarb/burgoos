import { BadRequestException, Inject, Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";
import type { Readable } from "node:stream";
import { DeliveryProvider, Prisma } from "@prisma/client";
import { StoreBrandingService } from "../customer-experience/branding/store-branding.service";
import { PrismaService } from "../platform/database/prisma.service";
import { normalizeStoreDomain } from "../platform/stores/store-domain";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ASSET_STORAGE, AssetStorage } from "../common/storage/asset-storage";

type BrandingAssetKey = "logo" | "header" | "body" | "footer";

type PublicImageAsset =
  | { value: string; body?: never; contentType?: never; contentLength?: never }
  | { body: Readable; contentType?: string; contentLength?: number; value?: never };

interface PublicStoreAddress {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

interface PublicStoreSocialLinks {
  instagram?: string;
  facebook?: string;
  whatsapp?: string;
  website?: string;
}

interface PublicMenuResponse {
  tenant: {
    name: string;
    slug: string;
    phone: string | null;
    isOpen: boolean;
    address: PublicStoreAddress | null;
    socialLinks: PublicStoreSocialLinks | null;
    branding: {
      logoUrl: string | null;
      headerImageUrl: string | null;
      bodyImageUrl: string | null;
      footerImageUrl: string | null;
      primaryColor: string;
      accentColor: string;
      neutralTheme: string;
      layoutPreset: string;
      showProductImages: boolean;
      showProductDescriptions: boolean;
      orderingEnabled: boolean;
    };
  };
  categories: Array<{
    id: string;
    name: string;
    products: Array<{
      id: string;
      name: string;
      description: string;
      price: string;
      imageUrl: string | null;
    }>;
  }>;
}

interface ProductFilters {
  search?: string;
  categoryId?: string;
  active?: boolean;
  provider?: DeliveryProvider;
}

interface CategoryFilters {
  search?: string;
  active?: boolean;
}

type ProductWithExternalMappings = Prisma.ProductGetPayload<{
  include: {
    externalMappings: {
      orderBy: {
        provider: "asc";
      };
    };
  };
}>;
type ProductResponseInput = Omit<ProductWithExternalMappings, "externalMappings"> & {
  externalMappings?: ProductWithExternalMappings["externalMappings"];
};

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StoreBrandingService) private readonly brandingService: StoreBrandingService,
    @Optional() @Inject(ASSET_STORAGE) private readonly assetStorage?: AssetStorage,
  ) {}

  async listCategories(tenantId: string, filters: CategoryFilters = {}) {
    const categories = await this.prisma.category.findMany({
      where: {
        tenantId,
        active: filters.active,
        name: filters.search ? { contains: filters.search, mode: "insensitive" } : undefined,
      },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      sortOrder: category.sortOrder,
      active: category.active,
      productCount: category._count.products,
    }));
  }

  async createCategory(tenantId: string, dto: CreateCategoryDto) {
    return this.prisma.category.create({
      data: {
        tenantId,
        name: dto.name,
        sortOrder: dto.sortOrder ?? 0,
        active: dto.active ?? true,
      },
    });
  }

  async deleteCategory(tenantId: string, categoryId: string) {
    await this.ensureCategoryBelongsToTenant(tenantId, categoryId);

    const productCount = await this.prisma.product.count({
      where: {
        tenantId,
        categoryId,
      },
    });

    if (productCount > 0) {
      throw new BadRequestException(
        "Nao e possivel excluir uma categoria com produtos vinculados. Inative a categoria ou mova os produtos antes."
      );
    }

    await this.prisma.category.delete({
      where: { id: categoryId },
    });

    return { deleted: true };
  }

  async updateCategory(tenantId: string, categoryId: string, dto: UpdateCategoryDto) {
    await this.ensureCategoryBelongsToTenant(tenantId, categoryId);

    return this.prisma.category.update({
      where: { id: categoryId },
      data: {
        name: dto.name,
        sortOrder: dto.sortOrder,
        active: dto.active,
      },
    });
  }

  async listProducts(tenantId: string, filters: ProductFilters = {}) {
    const where: Prisma.ProductWhereInput = {
      tenantId,
      categoryId: filters.categoryId || undefined,
      active: filters.active,
      OR: filters.search
        ? [
            { name: { contains: filters.search, mode: "insensitive" } },
            { description: { contains: filters.search, mode: "insensitive" } },
            {
              externalMappings: {
                some: {
                  externalProductId: { contains: filters.search, mode: "insensitive" },
                },
              },
            },
          ]
        : undefined,
      externalMappings: filters.provider
        ? {
            some: {
              provider: filters.provider,
            },
          }
        : undefined,
    };

    const products = await this.prisma.product.findMany({
      where,
      include: {
        externalMappings: {
          orderBy: {
            provider: "asc",
          },
        },
      },
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
    });

    return products.map((product) => this.toProductResponse(product));
  }

  async createProduct(tenantId: string, dto: CreateProductDto) {
    await this.ensureCategoryBelongsToTenant(tenantId, dto.categoryId);

    const product = await this.prisma.product.create({
      data: this.toProductCreateInput(tenantId, dto),
    });

    if (dto.externalMappings !== undefined) {
      await this.replaceExternalMappings(this.prisma, tenantId, product.id, dto.externalMappings);
      return this.findProductResponse(product.id);
    }

    return this.toProductResponse(product);
  }

  async updateProduct(tenantId: string, productId: string, dto: UpdateProductDto) {
    await this.ensureProductBelongsToTenant(tenantId, productId);

    if (dto.categoryId) {
      await this.ensureCategoryBelongsToTenant(tenantId, dto.categoryId);
    }

    const product = await this.prisma.product.update({
      where: { id: productId },
      data: {
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description,
        price: dto.price === undefined ? undefined : new Prisma.Decimal(dto.price),
        imageUrl: this.normalizeImageValue(dto.imageUrl),
        active: dto.active,
      },
    });

    if (dto.externalMappings !== undefined) {
      await this.replaceExternalMappings(this.prisma, tenantId, productId, dto.externalMappings);
      return this.findProductResponse(productId);
    }

    return this.toProductResponse(product);
  }

  async getPublicMenu(
    slug: string,
    assetBaseUrl: string | null = null
  ): Promise<PublicMenuResponse> {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        slug,
        active: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        phone: true,
        config: true,
        isOpen: true,
      },
    });

    if (!tenant) {
      this.logger.warn(`Public menu tenant resolution failed slug=${slug}`);
      throw new NotFoundException("Tenant not found");
    }

    const branding = await this.brandingService.getPublicBrandingForMenu(
      tenant.id,
      assetBaseUrl,
      tenant.slug
    );

    const categories = await this.prisma.category.findMany({
      where: {
        tenantId: tenant.id,
        active: true,
        products: {
          some: {
            active: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        products: {
          where: {
            active: true,
          },
          orderBy: {
            name: "asc",
          },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
          },
        },
      },
    });

    const productIdsWithImages =
      assetBaseUrl && branding.showProductImages
        ? await this.findPublicProductIdsWithImages(tenant.id)
        : new Set<string>();
    const profile = this.readPublicStoreProfile(tenant.config);

    return {
      tenant: {
        name: tenant.name,
        slug: tenant.slug,
        phone: tenant.phone || null,
        isOpen: tenant.isOpen,
        address: profile.address,
        socialLinks: profile.socialLinks,
        branding,
      },
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        products: category.products.map((product) => ({
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price.toFixed(2),
          imageUrl: productIdsWithImages.has(product.id)
            ? `${assetBaseUrl}/api/public/tenants/${tenant.slug}/products/${product.id}/image`
            : null,
        })),
      })),
    };
  }

  async getPublicMenuByDomain(
    requestedDomain: string,
    assetBaseUrl: string | null = null
  ): Promise<PublicMenuResponse> {
    let publicDomain: string;
    try {
      publicDomain = normalizeStoreDomain(requestedDomain);
    } catch {
      this.logger.warn("Public menu domain resolution rejected invalid domain");
      throw new NotFoundException("Tenant not found");
    }

    const tenant = await this.prisma.tenant.findFirst({
      where: { publicDomain, active: true },
      select: { slug: true },
    });

    if (!tenant) {
      this.logger.warn(`Public menu domain resolution failed domain=${publicDomain}`);
      throw new NotFoundException("Tenant not found");
    }

    return this.getPublicMenu(tenant.slug, assetBaseUrl);
  }

  async getPublicProductImage(slug: string, productId: string): Promise<PublicImageAsset> {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        active: true,
        tenant: {
          slug,
          active: true,
        },
        category: {
          active: true,
        },
      },
      select: {
        imageUrl: true,
      },
    });

    if (!product?.imageUrl) {
      throw new NotFoundException("Product image not found");
    }

    return this.resolvePublicImage(product.imageUrl);
  }

  async getPublicBrandingImage(slug: string, asset: BrandingAssetKey): Promise<PublicImageAsset> {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        slug,
        active: true,
      },
      select: {
        id: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    const branding = await this.brandingService.getPublicBranding(tenant.id);
    const value = {
      logo: branding.logoUrl,
      header: branding.headerImageUrl,
      body: branding.bodyImageUrl,
      footer: branding.footerImageUrl,
    }[asset];

    if (!value) {
      throw new NotFoundException("Branding image not found");
    }

    return this.resolvePublicImage(value);
  }

  private async resolvePublicImage(value: string): Promise<PublicImageAsset> {
    if (!isStoredAssetKey(value)) return { value };
    if (!this.assetStorage) throw new NotFoundException("Image storage unavailable");
    try {
      const stored = await this.assetStorage.read(value);
      return {
        body: stored.body,
        contentType: stored.contentType ?? contentTypeForAssetKey(value),
        contentLength: stored.contentLength,
      };
    } catch {
      throw new NotFoundException("Image asset not found");
    }
  }

  private async findPublicProductIdsWithImages(tenantId: string): Promise<Set<string>> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM products
      WHERE tenant_id = ${tenantId}::uuid
        AND active = true
        AND image_url IS NOT NULL
    `;

    return new Set(rows.map((row) => row.id));
  }

  private readPublicStoreProfile(config: Prisma.JsonValue): {
    address: PublicStoreAddress | null;
    socialLinks: PublicStoreSocialLinks | null;
  } {
    const root =
      typeof config === "object" && config !== null && !Array.isArray(config)
        ? (config as Record<string, unknown>)
        : {};
    const profile =
      typeof root.storeProfile === "object" && root.storeProfile !== null
        ? (root.storeProfile as Record<string, unknown>)
        : {};

    return {
      address: this.normalizePublicAddress(profile.address as PublicStoreAddress | undefined),
      socialLinks: this.normalizePublicSocialLinks(
        profile.socialLinks as PublicStoreSocialLinks | undefined
      ),
    };
  }

  private normalizePublicAddress(
    address: PublicStoreAddress | null | undefined
  ): PublicStoreAddress | null {
    if (!address || typeof address !== "object") {
      return null;
    }

    return this.withoutEmptyValues({
      street: this.cleanText(address.street),
      number: this.cleanText(address.number),
      complement: this.cleanText(address.complement),
      neighborhood: this.cleanText(address.neighborhood),
      city: this.cleanText(address.city),
      state: this.cleanText(address.state),
      postalCode: this.cleanText(address.postalCode),
    });
  }

  private normalizePublicSocialLinks(
    socialLinks: PublicStoreSocialLinks | null | undefined
  ): PublicStoreSocialLinks | null {
    if (!socialLinks || typeof socialLinks !== "object") {
      return null;
    }

    return this.withoutEmptyValues({
      instagram: this.cleanText(socialLinks.instagram),
      facebook: this.cleanText(socialLinks.facebook),
      whatsapp: this.cleanText(socialLinks.whatsapp),
      website: this.cleanText(socialLinks.website),
    });
  }

  private withoutEmptyValues<T extends Record<string, string | undefined>>(value: T): T | null {
    const entries = Object.entries(value).filter(([, field]) => Boolean(field));
    return entries.length > 0 ? (Object.fromEntries(entries) as T) : null;
  }

  private cleanText(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private async ensureCategoryBelongsToTenant(tenantId: string, categoryId: string): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        tenantId,
      },
      select: {
        id: true,
      },
    });

    if (!category) {
      this.logger.warn(
        `Category tenant scope rejected tenantId=${tenantId} categoryId=${categoryId}`
      );
      throw new NotFoundException("Category not found");
    }
  }

  private async ensureProductBelongsToTenant(tenantId: string, productId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        tenantId,
      },
      select: {
        id: true,
      },
    });

    if (!product) {
      this.logger.warn(`Product tenant scope rejected tenantId=${tenantId} productId=${productId}`);
      throw new NotFoundException("Product not found");
    }
  }

  private toProductCreateInput(
    tenantId: string,
    dto: CreateProductDto
  ): Prisma.ProductUncheckedCreateInput {
    if (dto.price < 0) {
      throw new BadRequestException("Product price must be positive");
    }

    return {
      tenantId,
      categoryId: dto.categoryId,
      name: dto.name,
      description: dto.description ?? "",
      price: new Prisma.Decimal(dto.price),
      imageUrl: this.normalizeImageValue(dto.imageUrl),
      active: dto.active ?? true,
    };
  }

  private async replaceExternalMappings(
    client: Pick<PrismaService, "productExternalMapping">,
    tenantId: string,
    productId: string,
    mappings: CreateProductDto["externalMappings"] | UpdateProductDto["externalMappings"]
  ) {
    const normalized = this.normalizeExternalMappings(mappings);

    await client.productExternalMapping.deleteMany({
      where: {
        tenantId,
        productId,
      },
    });

    if (normalized.length === 0) {
      return;
    }

    await client.productExternalMapping.createMany({
      data: normalized.map((mapping) => ({
        tenantId,
        productId,
        provider: mapping.provider,
        externalProductId: mapping.externalProductId,
      })),
    });
  }

  private async findProductResponse(productId: string) {
    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: {
        externalMappings: {
          orderBy: {
            provider: "asc",
          },
        },
      },
    });

    return this.toProductResponse(product);
  }

  private normalizeExternalMappings(
    mappings: CreateProductDto["externalMappings"] | UpdateProductDto["externalMappings"]
  ) {
    const normalized =
      mappings
        ?.map((mapping) => ({
          provider: mapping.provider,
          externalProductId: mapping.externalProductId.trim(),
        }))
        .filter((mapping) => mapping.externalProductId.length > 0) ?? [];
    const providers = new Set<DeliveryProvider>();

    normalized.forEach((mapping) => {
      if (providers.has(mapping.provider)) {
        throw new BadRequestException("Only one external product ID per provider is allowed");
      }
      providers.add(mapping.provider);
    });

    return normalized;
  }

  private normalizeImageValue(value?: string | null): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    const normalized = value?.trim() ?? "";
    if (!normalized) {
      return null;
    }

    if (isHttpUrl(normalized) || isImageDataUrl(normalized) || isStoredAssetKey(normalized)) {
      return normalized;
    }

    throw new BadRequestException("Product image must be a URL, asset key or legacy base64 image");
  }

  private toProductResponse(product: ProductResponseInput) {
    const price = product.price as unknown;

    return {
      ...product,
      price: typeof price === "string" ? price : product.price.toFixed(2),
      externalMappings: (product.externalMappings ?? []).map((mapping) => ({
        id: mapping.id,
        provider: mapping.provider,
        externalProductId: mapping.externalProductId,
      })),
    };
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isImageDataUrl(value: string): boolean {
  return /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(value);
}

function isStoredAssetKey(value: string): boolean {
  return /^tenants\/[a-f0-9-]+\/images\/[a-z_]+\/[a-f0-9-]+\.(png|jpe?g|webp)$/i.test(value);
}

function contentTypeForAssetKey(value: string): string {
  if (/\.png$/i.test(value)) return "image/png";
  if (/\.webp$/i.test(value)) return "image/webp";
  return "image/jpeg";
}
