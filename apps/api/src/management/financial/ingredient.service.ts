import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";
import { TenantScopeService } from "../tenant-scope";
import { calculateIngredientUnitCost } from "./ingredient-cost";
import { toMoneyString } from "./money";
import { IngredientDto } from "./dto/ingredient.dto";

@Injectable()
export class IngredientService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TenantScopeService) private readonly tenantScope: TenantScopeService
  ) {}

  async list(tenantId: string) {
    const ingredients = await this.prisma.ingredient.findMany({
      where: { tenantId },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });

    return ingredients.map((ingredient) => this.toResponse(ingredient));
  }

  async create(tenantId: string, dto: IngredientDto) {
    await this.ensureDomainLinks(tenantId, dto);
    const unitCost = calculateIngredientUnitCost(dto.purchaseCost, dto.purchaseQuantity);

    const ingredient = await this.prisma.ingredient.create({
      data: {
        tenantId,
        purchaseUnitId: dto.purchaseUnitId,
        supplierId: dto.supplierId,
        name: dto.name,
        category: dto.category,
        purchaseQuantity: new Prisma.Decimal(dto.purchaseQuantity),
        purchaseCost: new Prisma.Decimal(dto.purchaseCost),
        unitCost,
        currentStock: new Prisma.Decimal(dto.currentStock ?? 0),
        minimumStock: new Prisma.Decimal(dto.minimumStock ?? 0),
        active: dto.active ?? true,
      },
    });

    return this.toResponse(ingredient);
  }

  async update(tenantId: string, id: string, dto: IngredientDto) {
    await this.tenantScope.ensureTenantRecord("ingredient", tenantId, id);
    await this.ensureDomainLinks(tenantId, dto);
    const unitCost = calculateIngredientUnitCost(dto.purchaseCost, dto.purchaseQuantity);

    const ingredient = await this.prisma.ingredient.update({
      where: { id },
      data: {
        purchaseUnitId: dto.purchaseUnitId,
        supplierId: dto.supplierId,
        name: dto.name,
        category: dto.category,
        purchaseQuantity: new Prisma.Decimal(dto.purchaseQuantity),
        purchaseCost: new Prisma.Decimal(dto.purchaseCost),
        unitCost,
        currentStock: new Prisma.Decimal(dto.currentStock ?? 0),
        minimumStock: new Prisma.Decimal(dto.minimumStock ?? 0),
        active: dto.active,
      },
    });

    return this.toResponse(ingredient);
  }

  private async ensureDomainLinks(tenantId: string, dto: IngredientDto): Promise<void> {
    const unit = await this.prisma.purchaseUnit.findFirst({
      where: {
        id: dto.purchaseUnitId,
        tenantId,
        active: true,
      },
      select: { id: true },
    });

    if (!unit) {
      throw new NotFoundException("Purchase unit not found");
    }

    if (!dto.supplierId) {
      return;
    }

    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: dto.supplierId,
        tenantId,
        active: true,
      },
      select: { id: true },
    });

    if (!supplier) {
      throw new NotFoundException("Supplier not found");
    }
  }

  private toResponse(ingredient: {
    id: string;
    name: string;
    category: string;
    purchaseUnitId: string;
    supplierId: string | null;
    purchaseQuantity: Prisma.Decimal;
    purchaseCost: Prisma.Decimal;
    unitCost: Prisma.Decimal;
    currentStock: Prisma.Decimal;
    minimumStock: Prisma.Decimal;
    active: boolean;
  }) {
    return {
      id: ingredient.id,
      name: ingredient.name,
      category: ingredient.category,
      purchaseUnitId: ingredient.purchaseUnitId,
      supplierId: ingredient.supplierId,
      purchaseQuantity: ingredient.purchaseQuantity.toNumber(),
      purchaseCost: toMoneyString(ingredient.purchaseCost),
      unitCost: ingredient.unitCost.toFixed(4),
      currentStock: ingredient.currentStock.toNumber(),
      minimumStock: ingredient.minimumStock.toNumber(),
      active: ingredient.active,
    };
  }
}
