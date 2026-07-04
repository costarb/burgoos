import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { DeliveryProvider, Prisma } from "@prisma/client";
import { StoreBrandingService } from "../customer-experience/branding/store-branding.service";
import { PrismaService } from "../platform/database/prisma.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

interface PublicMenuResponse {
  tenant: {
    name: string;
    slug: string;
    isOpen: boolean;
    branding: {
      logoUrl: string | null;
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
    @Inject(StoreBrandingService) private readonly brandingService: StoreBrandingService
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

  async getPublicMenu(slug: string): Promise<PublicMenuResponse> {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        slug,
        active: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        isOpen: true,
      },
    });

    if (!tenant) {
      this.logger.warn(`Public menu tenant resolution failed slug=${slug}`);
      throw new NotFoundException("Tenant not found");
    }

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
            imageUrl: true,
          },
        },
      },
    });

    const branding = await this.brandingService.getPublicBranding(tenant.id);

    return {
      tenant: {
        name: tenant.name,
        slug: tenant.slug,
        isOpen: tenant.isOpen,
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
          imageUrl: product.imageUrl,
        })),
      })),
    };
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

    if (isHttpUrl(normalized) || isImageDataUrl(normalized)) {
      return normalized;
    }

    throw new BadRequestException("Product image must be a URL or base64 image upload");
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
