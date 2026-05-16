import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";
import { toMoneyString } from "./money";
import { calculateTechnicalSheetCost } from "./technical-sheet-cost";
import { ReplaceTechnicalSheetDto } from "./dto/technical-sheet.dto";

@Injectable()
export class TechnicalSheetService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listSummaries(tenantId: string) {
    const sheets = await this.prisma.technicalSheet.findMany({
      where: {
        tenantId,
        active: true,
      },
      include: {
        lines: {
          select: {
            itemCost: true,
          },
        },
      },
    });

    return sheets.map((sheet) => {
      const ingredientCmv = sheet.lines.reduce(
        (total, line) => total.add(line.itemCost),
        new Prisma.Decimal(0)
      );

      return {
        productId: sheet.productId,
        complete: sheet.lines.length > 0,
        lineCount: sheet.lines.length,
        ingredientCmv: toMoneyString(ingredientCmv),
      };
    });
  }

  async get(tenantId: string, productId: string) {
    await this.ensureProduct(tenantId, productId);

    const sheet = await this.prisma.technicalSheet.findFirst({
      where: {
        tenantId,
        productId,
        active: true,
      },
      include: {
        lines: {
          include: {
            ingredient: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!sheet) {
      return {
        productId,
        complete: false,
        ingredientCmv: "0.00",
        lines: [],
      };
    }

    const ingredientCmv = sheet.lines.reduce(
      (total, line) => total.add(line.itemCost),
      new Prisma.Decimal(0)
    );

    return {
      productId,
      complete: sheet.lines.length > 0,
      ingredientCmv: toMoneyString(ingredientCmv),
      lines: sheet.lines.map((line) => ({
        id: line.id,
        ingredientId: line.ingredientId,
        ingredientName: line.ingredient.name,
        quantityUsed: line.quantityUsed.toNumber(),
        unitCostSnapshot: line.unitCostSnapshot.toFixed(4),
        itemCost: toMoneyString(line.itemCost),
        isPackaging: line.isPackaging,
        notes: line.notes,
      })),
    };
  }

  async replace(tenantId: string, productId: string, dto: ReplaceTechnicalSheetDto) {
    await this.ensureProduct(tenantId, productId);

    const ingredients = await this.prisma.ingredient.findMany({
      where: {
        tenantId,
        id: {
          in: dto.lines.map((line) => line.ingredientId),
        },
        active: true,
      },
    });
    const ingredientsById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));

    if (ingredientsById.size !== new Set(dto.lines.map((line) => line.ingredientId)).size) {
      throw new NotFoundException("Ingredient not found");
    }

    const calculated = calculateTechnicalSheetCost(
      dto.lines.map((line) => {
        const ingredient = ingredientsById.get(line.ingredientId);

        if (!ingredient) {
          throw new NotFoundException("Ingredient not found");
        }

        return {
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          quantityUsed: line.quantityUsed,
          unitCost: ingredient.unitCost,
          isPackaging: line.isPackaging ?? false,
          notes: line.notes,
        };
      })
    );

    const existing = await this.prisma.technicalSheet.findFirst({
      where: {
        tenantId,
        productId,
        active: true,
      },
      select: {
        id: true,
      },
    });

    const sheet = existing
      ? await this.prisma.technicalSheet.update({
          where: { id: existing.id },
          data: {
            lines: {
              deleteMany: {},
              create: calculated.lines.map((line) => ({
                tenantId,
                ingredientId: line.ingredientId,
                quantityUsed: new Prisma.Decimal(line.quantityUsed),
                unitCostSnapshot: new Prisma.Decimal(line.unitCostSnapshot),
                itemCost: new Prisma.Decimal(line.itemCost),
                isPackaging: line.isPackaging,
                notes: line.notes,
              })),
            },
          },
          include: {
            lines: {
              include: {
                ingredient: true,
              },
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        })
      : await this.prisma.technicalSheet.create({
          data: {
            tenantId,
            productId,
            active: true,
            lines: {
              create: calculated.lines.map((line) => ({
                tenantId,
                ingredientId: line.ingredientId,
                quantityUsed: new Prisma.Decimal(line.quantityUsed),
                unitCostSnapshot: new Prisma.Decimal(line.unitCostSnapshot),
                itemCost: new Prisma.Decimal(line.itemCost),
                isPackaging: line.isPackaging,
                notes: line.notes,
              })),
            },
          },
          include: {
            lines: {
              include: {
                ingredient: true,
              },
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        });

    const ingredientCmv = sheet.lines.reduce(
      (total, line) => total.add(line.itemCost),
      new Prisma.Decimal(0)
    );

    return {
      productId,
      complete: sheet.lines.length > 0,
      ingredientCmv: toMoneyString(ingredientCmv),
      lines: sheet.lines.map((line) => ({
        id: line.id,
        ingredientId: line.ingredientId,
        ingredientName: line.ingredient.name,
        quantityUsed: line.quantityUsed.toNumber(),
        unitCostSnapshot: line.unitCostSnapshot.toFixed(4),
        itemCost: toMoneyString(line.itemCost),
        isPackaging: line.isPackaging,
        notes: line.notes,
      })),
    };
  }

  private async ensureProduct(tenantId: string, productId: string): Promise<void> {
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
      throw new NotFoundException("Product not found");
    }
  }
}
