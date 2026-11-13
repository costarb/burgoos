import { Inject, Injectable } from "@nestjs/common";
import type { FiscalProfile } from "@prisma/client";
import { PrismaService } from "../../../platform/database/prisma.service";

export interface ProfileResolution {
  products: Map<string, FiscalProfile | null>;
  complements: Map<string, FiscalProfile | null>;
}

/**
 * Resolves the fiscal profile of each item:
 * product → its own profile, else its category's; complement → its own profile, else the
 * resolved profile of the product it was added to. Inactive profiles do not count.
 */
@Injectable()
export class FiscalProfileResolver {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async resolveProducts(tenantId: string, productIds: string[]): Promise<Map<string, FiscalProfile | null>> {
    const unique = [...new Set(productIds)];
    if (!unique.length) return new Map();
    const products = await this.prisma.product.findMany({
      where: { tenantId, id: { in: unique } },
      select: {
        id: true,
        fiscalProfile: true,
        category: { select: { fiscalProfile: true } },
      },
    });
    const resolved = new Map<string, FiscalProfile | null>(unique.map((id) => [id, null]));
    for (const product of products) {
      resolved.set(product.id, activeOrNull(product.fiscalProfile) ?? activeOrNull(product.category?.fiscalProfile));
    }
    return resolved;
  }

  async resolveComplements(tenantId: string, complementIds: string[]): Promise<Map<string, FiscalProfile | null>> {
    const unique = [...new Set(complementIds)];
    if (!unique.length) return new Map();
    const complements = await this.prisma.productComplement.findMany({
      where: { tenantId, id: { in: unique } },
      select: { id: true, fiscalProfile: true },
    });
    const resolved = new Map<string, FiscalProfile | null>(unique.map((id) => [id, null]));
    for (const complement of complements) resolved.set(complement.id, activeOrNull(complement.fiscalProfile));
    return resolved;
  }

  /** Complement profile with fallback to the parent product's resolved profile. */
  static forComplement(
    complementProfile: FiscalProfile | null | undefined,
    parentProductProfile: FiscalProfile | null | undefined
  ): FiscalProfile | null {
    return complementProfile ?? parentProductProfile ?? null;
  }
}

function activeOrNull(profile: FiscalProfile | null | undefined): FiscalProfile | null {
  return profile && profile.active ? profile : null;
}
