import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../platform/database/prisma.service";

@Injectable()
export class CounterCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async getCatalog(tenantId: string) {
    const categories = await this.prisma.category.findMany({
      where: { tenantId, active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        products: {
          where: { tenantId, active: true },
          orderBy: { name: "asc" },
          include: {
            technicalSheets: {
              where: { tenantId, active: true },
              take: 1,
              include: {
                lines: {
                  include: { ingredient: { select: { id: true, name: true } } },
                },
              },
            },
            complementAssignments: {
              where: { active: true, complement: { tenantId, active: true } },
              include: { complement: true },
              orderBy: { complement: { sortOrder: "asc" } },
            },
          },
        },
      },
    });

    return {
      generatedAt: new Date().toISOString(),
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        sortOrder: category.sortOrder,
        products: category.products.map((product) => ({
          id: product.id,
          categoryId: product.categoryId,
          name: product.name,
          description: product.description,
          price: product.price.toFixed(2),
          imageUrl: product.imageUrl,
          active: product.active,
          ingredients: (product.technicalSheets[0]?.lines ?? [])
            .filter((line) => !line.isPackaging)
            .map((line) => ({
              id: line.ingredient.id,
              name: line.ingredient.name,
              removable: true,
            })),
          complements: product.complementAssignments
            .filter((assignment) => assignment.active && assignment.complement.active)
            .map((assignment) => ({
              id: assignment.complement.id,
              name: assignment.complement.name,
              description: assignment.complement.description,
              price: assignment.complement.price.toFixed(2),
              maxQuantity: Math.min(
                assignment.maxQuantity,
                assignment.complement.maxQuantity,
              ),
              active: true,
            })),
        })),
      })),
    };
  }
}
