import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { AccessAuditEventType, AccessAuditResult, FiscalProfile, Prisma } from "@prisma/client";
import type {
  FiscalMissingProfiles,
  FiscalProfileAssignmentsPayload,
  FiscalProfilePayload,
  FiscalProfileView,
} from "../fiscal.types";
import { AuthUser } from "../../../platform/auth/auth.types";
import { PrismaService } from "../../../platform/database/prisma.service";
import { AccessAuditService } from "../../access/access-audit.service";
import { validateFiscalProfile } from "./fiscal-profile-rules";

@Injectable()
export class FiscalProfileService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccessAuditService) private readonly audit: AccessAuditService
  ) {}

  async list(tenantId: string): Promise<FiscalProfileView[]> {
    const profiles = await this.prisma.fiscalProfile.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      include: { _count: { select: { categories: true, products: true, complements: true } } },
    });
    return profiles.map((profile) => toView(profile, profile._count));
  }

  async create(user: AuthUser, payload: FiscalProfilePayload): Promise<FiscalProfileView> {
    const value = this.validate(payload);
    try {
      const profile = await this.prisma.fiscalProfile.create({
        data: { tenantId: user.tenantId, ...value, active: payload.active ?? true },
      });
      await this.record(user, "created", profile.id, { name: profile.name });
      return toView(profile, { categories: 0, products: 0, complements: 0 });
    } catch (error) {
      throw this.translateUnique(error);
    }
  }

  async update(user: AuthUser, id: string, payload: FiscalProfilePayload): Promise<FiscalProfileView> {
    const current = await this.require(user.tenantId, id);
    const value = this.validate(payload);
    try {
      await this.prisma.fiscalProfile.update({
        where: { id: current.id },
        data: { ...value, active: payload.active ?? current.active },
      });
    } catch (error) {
      throw this.translateUnique(error);
    }
    await this.record(user, "updated", id, { before: pick(current), after: value });
    return (await this.list(user.tenantId)).find((profile) => profile.id === id) as FiscalProfileView;
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    await this.require(user.tenantId, id);
    const usage = await this.usage(user.tenantId, id);
    if (usage.categories + usage.products + usage.complements > 0) {
      throw new ConflictException({ code: "PROFILE_IN_USE", message: "Perfil fiscal em uso", usage });
    }
    await this.prisma.fiscalProfile.delete({ where: { id } });
    await this.record(user, "deleted", id, {});
  }

  async assign(user: AuthUser, payload: FiscalProfileAssignmentsPayload): Promise<{ updated: number }> {
    const groups = {
      categories: payload.categories ?? [],
      products: payload.products ?? [],
      complements: payload.complements ?? [],
    };
    const profileIds = [
      ...new Set(
        Object.values(groups)
          .flat()
          .map((item) => item.fiscalProfileId)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    if (profileIds.length) {
      const found = await this.prisma.fiscalProfile.count({
        where: { tenantId: user.tenantId, id: { in: profileIds }, active: true },
      });
      if (found !== profileIds.length) {
        throw new UnprocessableEntityException({ code: "INVALID_PROFILE", message: "Perfil fiscal inexistente ou inativo" });
      }
    }
    const tenantId = user.tenantId;
    const updated = await this.prisma.$transaction(async (tx) => {
      let count = 0;
      for (const item of groups.categories) {
        count += (await tx.category.updateMany({ where: { id: item.id, tenantId }, data: { fiscalProfileId: item.fiscalProfileId } })).count;
      }
      for (const item of groups.products) {
        count += (await tx.product.updateMany({ where: { id: item.id, tenantId }, data: { fiscalProfileId: item.fiscalProfileId } })).count;
      }
      for (const item of groups.complements) {
        count += (
          await tx.productComplement.updateMany({ where: { id: item.id, tenantId }, data: { fiscalProfileId: item.fiscalProfileId } })
        ).count;
      }
      return count;
    });
    await this.record(user, "assigned", null, {
      categories: groups.categories.length,
      products: groups.products.length,
      complements: groups.complements.length,
    });
    return { updated };
  }

  /** Current assignments for the assignment screen (active catalog only). */
  async assignments(tenantId: string) {
    const [categories, products, complements] = await Promise.all([
      this.prisma.category.findMany({
        where: { tenantId, active: true },
        select: { id: true, name: true, fiscalProfileId: true },
        orderBy: { sortOrder: "asc" },
      }),
      this.prisma.product.findMany({
        where: { tenantId, active: true },
        select: { id: true, name: true, categoryId: true, fiscalProfileId: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.productComplement.findMany({
        where: { tenantId, active: true },
        select: { id: true, name: true, fiscalProfileId: true },
        orderBy: { name: "asc" },
      }),
    ]);
    return { categories, products, complements };
  }

  /** Active products (and complements in use by them) whose fiscal profile cannot be resolved. */
  async missing(tenantId: string): Promise<FiscalMissingProfiles> {
    const products = await this.prisma.product.findMany({
      where: { tenantId, active: true },
      select: {
        id: true,
        name: true,
        fiscalProfile: { select: { active: true } },
        category: { select: { name: true, fiscalProfile: { select: { active: true } } } },
        complementAssignments: {
          where: { active: true },
          select: { complement: { select: { id: true, name: true, active: true, fiscalProfile: { select: { active: true } } } } },
        },
      },
      orderBy: { name: "asc" },
    });
    const missingProducts: FiscalMissingProfiles["products"] = [];
    const missingComplements = new Map<string, string>();
    for (const product of products) {
      const resolved = Boolean(product.fiscalProfile?.active || product.category?.fiscalProfile?.active);
      if (!resolved) missingProducts.push({ id: product.id, name: product.name, categoryName: product.category?.name ?? "" });
      for (const { complement } of product.complementAssignments) {
        // A complement without its own profile falls back to the parent product's profile.
        if (complement.active && !complement.fiscalProfile?.active && !resolved) {
          missingComplements.set(complement.id, complement.name);
        }
      }
    }
    return {
      products: missingProducts,
      complements: [...missingComplements].map(([id, name]) => ({ id, name })),
    };
  }

  async hasDefaultProfile(tenantId: string): Promise<boolean> {
    const count = await this.prisma.category.count({
      where: { tenantId, active: true, fiscalProfile: { is: { active: true } } },
    });
    return count > 0;
  }

  private async usage(tenantId: string, id: string) {
    const [categories, products, complements] = await Promise.all([
      this.prisma.category.count({ where: { tenantId, fiscalProfileId: id } }),
      this.prisma.product.count({ where: { tenantId, fiscalProfileId: id } }),
      this.prisma.productComplement.count({ where: { tenantId, fiscalProfileId: id } }),
    ]);
    return { categories, products, complements };
  }

  private validate(payload: FiscalProfilePayload) {
    const result = validateFiscalProfile(payload);
    if (!result.ok) {
      throw new UnprocessableEntityException({ code: "INVALID_PROFILE", message: result.errors.join("; "), errors: result.errors });
    }
    return result.value;
  }

  private async require(tenantId: string, id: string): Promise<FiscalProfile> {
    const profile = await this.prisma.fiscalProfile.findFirst({ where: { id, tenantId } });
    if (!profile) throw new NotFoundException("Perfil fiscal nao encontrado");
    return profile;
  }

  private translateUnique(error: unknown): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return new ConflictException({ code: "PROFILE_NAME_TAKEN", message: "Ja existe um perfil fiscal com esse nome" });
    }
    return error;
  }

  private async record(user: AuthUser, action: string, profileId: string | null, details: Record<string, unknown>) {
    await this.audit.record({
      actorUserId: user.id,
      storeId: user.tenantId,
      eventType: AccessAuditEventType.FISCAL_PROFILE_CHANGED,
      result: AccessAuditResult.SUCCESS,
      metadata: { action, profileId, ...details } as Prisma.InputJsonValue,
    });
  }
}

function pick(profile: FiscalProfile) {
  const { name, ncm, cfop, csosn, origin, commercialUnit, cest, benefitCode } = profile;
  return { name, ncm, cfop, csosn, origin, commercialUnit, cest, benefitCode };
}

function toView(
  profile: FiscalProfile,
  usage: { categories: number; products: number; complements: number }
): FiscalProfileView {
  return {
    id: profile.id,
    name: profile.name,
    ncm: profile.ncm,
    cfop: profile.cfop,
    csosn: profile.csosn,
    origin: profile.origin,
    commercialUnit: profile.commercialUnit,
    cest: profile.cest,
    benefitCode: profile.benefitCode,
    active: profile.active,
    usage: { categories: usage.categories, products: usage.products, complements: usage.complements },
  };
}
