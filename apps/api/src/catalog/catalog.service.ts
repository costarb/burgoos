import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma, Product } from "@prisma/client";
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

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listCategories(tenantId: string) {
    return this.prisma.category.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
  }

  async createCategory(tenantId: string, dto: CreateCategoryDto) {
    return this.prisma.category.create({
      data: {
        tenantId,
        name: dto.name,
        sortOrder: dto.sortOrder ?? 0,
        active: dto.active ?? true
      }
    });
  }

  async updateCategory(tenantId: string, categoryId: string, dto: UpdateCategoryDto) {
    await this.ensureCategoryBelongsToTenant(tenantId, categoryId);

    return this.prisma.category.update({
      where: { id: categoryId },
      data: {
        name: dto.name,
        sortOrder: dto.sortOrder,
        active: dto.active
      }
    });
  }

  async listProducts(tenantId: string) {
    return this.prisma.product.findMany({
      where: { tenantId },
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }]
    });
  }

  async createProduct(tenantId: string, dto: CreateProductDto) {
    await this.ensureCategoryBelongsToTenant(tenantId, dto.categoryId);

    return this.prisma.product.create({
      data: this.toProductCreateInput(tenantId, dto)
    });
  }

  async updateProduct(tenantId: string, productId: string, dto: UpdateProductDto): Promise<Product> {
    await this.ensureProductBelongsToTenant(tenantId, productId);

    if (dto.categoryId) {
      await this.ensureCategoryBelongsToTenant(tenantId, dto.categoryId);
    }

    return this.prisma.product.update({
      where: { id: productId },
      data: {
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description,
        price: dto.price === undefined ? undefined : new Prisma.Decimal(dto.price),
        imageUrl: dto.imageUrl,
        active: dto.active
      }
    });
  }

  async getPublicMenu(slug: string): Promise<PublicMenuResponse> {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        slug,
        active: true
      },
      select: {
        id: true,
        name: true,
        slug: true,
        isOpen: true
      }
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
            active: true
          }
        }
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        products: {
          where: {
            active: true
          },
          orderBy: {
            name: "asc"
          },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            imageUrl: true
          }
        }
      }
    });

    return {
      tenant: {
        name: tenant.name,
        slug: tenant.slug,
        isOpen: tenant.isOpen
      },
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        products: category.products.map((product) => ({
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price.toFixed(2),
          imageUrl: product.imageUrl
        }))
      }))
    };
  }

  private async ensureCategoryBelongsToTenant(tenantId: string, categoryId: string): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        tenantId
      },
      select: {
        id: true
      }
    });

    if (!category) {
      this.logger.warn(`Category tenant scope rejected tenantId=${tenantId} categoryId=${categoryId}`);
      throw new NotFoundException("Category not found");
    }
  }

  private async ensureProductBelongsToTenant(tenantId: string, productId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        tenantId
      },
      select: {
        id: true
      }
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
      imageUrl: dto.imageUrl,
      active: dto.active ?? true
    };
  }
}
