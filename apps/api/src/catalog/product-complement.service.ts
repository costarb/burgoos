import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../platform/database/prisma.service";
import {
  CreateProductComplementDto,
  UpdateProductComplementDto,
} from "./dto/product-complement.dto";

@Injectable()
export class ProductComplementService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.productComplement.findMany({
      where: { tenantId },
      include: {
        assignments: {
          where: { product: { tenantId } },
          select: { productId: true, active: true, maxQuantity: true },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  async create(tenantId: string, dto: CreateProductComplementDto) {
    await this.validateReferences(tenantId, dto.productIds ?? [], dto.ingredientId);
    return this.prisma.productComplement.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        price: new Prisma.Decimal(dto.price),
        ingredientId: dto.ingredientId,
        maxQuantity: dto.maxQuantity ?? 1,
        sortOrder: dto.sortOrder ?? 0,
        active: dto.active ?? true,
        assignments: {
          create: (dto.productIds ?? []).map((productId) => ({
            productId,
            maxQuantity: dto.maxQuantity ?? 1,
          })),
        },
      },
      include: { assignments: true },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateProductComplementDto) {
    const current = await this.prisma.productComplement.findFirst({ where: { id, tenantId } });
    if (!current) throw new NotFoundException("Complemento nao encontrado");
    await this.validateReferences(tenantId, dto.productIds ?? [], dto.ingredientId ?? undefined);

    return this.prisma.$transaction(async (tx) => {
      if (dto.productIds) {
        await tx.productComplementAssignment.deleteMany({ where: { complementId: id } });
      }
      return tx.productComplement.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          description: dto.description === null ? null : dto.description?.trim(),
          price: dto.price ? new Prisma.Decimal(dto.price) : undefined,
          ingredientId: dto.ingredientId,
          maxQuantity: dto.maxQuantity,
          sortOrder: dto.sortOrder,
          active: dto.active,
          assignments: dto.productIds
            ? {
                create: dto.productIds.map((productId) => ({
                  productId,
                  maxQuantity: dto.maxQuantity ?? current.maxQuantity,
                })),
              }
            : undefined,
        },
        include: { assignments: true },
      });
    });
  }

  private async validateReferences(
    tenantId: string,
    productIds: string[],
    ingredientId?: string,
  ) {
    const [productCount, ingredientCount] = await Promise.all([
      this.prisma.product.count({ where: { tenantId, id: { in: productIds } } }),
      ingredientId
        ? this.prisma.ingredient.count({ where: { tenantId, id: ingredientId } })
        : Promise.resolve(0),
    ]);
    if (productCount !== productIds.length || (ingredientId && ingredientCount !== 1)) {
      throw new UnprocessableEntityException("Produto ou ingrediente invalido para esta loja");
    }
  }
}
