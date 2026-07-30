import { ForbiddenException, Injectable, UnprocessableEntityException } from "@nestjs/common";
import { ItemModificationType, Prisma } from "@prisma/client";

export interface CounterProductPricing {
  id: string;
  name: string;
  price: Prisma.Decimal;
  removableIngredients: Array<{ id: string; name: string }>;
  complements: Array<{
    id: string;
    name: string;
    price: Prisma.Decimal;
    maxQuantity: number;
  }>;
}

export interface CounterItemPricingInput {
  productId: string;
  quantity: number;
  modifications?: Array<{
    type: "REMOVE_INGREDIENT" | "ADD_COMPLEMENT";
    referenceId: string;
    quantity: number;
  }>;
  chargedUnitPrice?: string;
  priceOverrideReason?: string;
  notes?: string;
}

@Injectable()
export class CounterOrderCalculator {
  calculate(
    inputs: CounterItemPricingInput[],
    products: Map<string, CounterProductPricing>,
    authorization: { canOverridePrice: boolean; actorUserId: string },
  ) {
    const items = inputs.map((input) => {
      const product = products.get(input.productId);
      if (!product) {
        throw new UnprocessableEntityException("Produto indisponivel");
      }
      if (!Number.isInteger(input.quantity) || input.quantity < 1) {
        throw new UnprocessableEntityException("Quantidade de item invalida");
      }

      let complementDelta = new Prisma.Decimal(0);
      const modifications = (input.modifications ?? []).map((modification) => {
        if (modification.quantity <= 0) {
          throw new UnprocessableEntityException("Quantidade de personalizacao invalida");
        }
        if (modification.type === "REMOVE_INGREDIENT") {
          const ingredient = product.removableIngredients.find(
            (candidate) => candidate.id === modification.referenceId,
          );
          if (!ingredient) {
            throw new UnprocessableEntityException("Ingrediente nao pode ser removido");
          }
          return {
            type: ItemModificationType.REMOVE_INGREDIENT,
            ingredientId: ingredient.id,
            complementId: null,
            nameSnapshot: ingredient.name,
            quantity: new Prisma.Decimal(modification.quantity),
            unitPriceDelta: new Prisma.Decimal(0),
            totalPriceDelta: new Prisma.Decimal(0),
          };
        }

        const complement = product.complements.find(
          (candidate) => candidate.id === modification.referenceId,
        );
        if (!complement || modification.quantity > complement.maxQuantity) {
          throw new UnprocessableEntityException("Complemento indisponivel ou acima do limite");
        }
        const totalPriceDelta = complement.price.mul(modification.quantity);
        complementDelta = complementDelta.add(totalPriceDelta);
        return {
          type: ItemModificationType.ADD_COMPLEMENT,
          ingredientId: null,
          complementId: complement.id,
          nameSnapshot: complement.name,
          quantity: new Prisma.Decimal(modification.quantity),
          unitPriceDelta: complement.price,
          totalPriceDelta,
        };
      });

      const calculatedUnitPrice = product.price.add(complementDelta);
      const chargedUnitPrice = input.chargedUnitPrice
        ? new Prisma.Decimal(input.chargedUnitPrice)
        : calculatedUnitPrice;
      const overridden = !chargedUnitPrice.equals(calculatedUnitPrice);
      if (overridden && !authorization.canOverridePrice) {
        throw new ForbiddenException("Sem permissao para alterar o preco");
      }
      if (overridden && !input.priceOverrideReason?.trim()) {
        throw new UnprocessableEntityException("Motivo da alteracao de preco obrigatorio");
      }
      if (chargedUnitPrice.isNegative()) {
        throw new UnprocessableEntityException("Preco cobrado invalido");
      }

      return {
        productId: product.id,
        productNameSnapshot: product.name,
        quantity: input.quantity,
        baseUnitPrice: product.price,
        calculatedUnitPrice,
        chargedUnitPrice,
        unitPrice: chargedUnitPrice,
        total: chargedUnitPrice.mul(input.quantity),
        manualAdjustmentAmount: chargedUnitPrice.sub(calculatedUnitPrice),
        manualAdjustmentReason: overridden ? input.priceOverrideReason!.trim() : null,
        manualAdjustmentByUserId: overridden ? authorization.actorUserId : null,
        notes: input.notes?.trim() || null,
        modifications,
      };
    });

    return {
      items,
      total: items.reduce((sum, item) => sum.add(item.total), new Prisma.Decimal(0)),
    };
  }
}
