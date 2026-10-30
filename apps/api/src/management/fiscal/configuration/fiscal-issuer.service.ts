import { Inject, Injectable, UnprocessableEntityException } from "@nestjs/common";
import { AccessAuditEventType, AccessAuditResult } from "@prisma/client";
import type { FiscalAddress, FiscalIssuerView } from "../fiscal.types";
import { AuthUser } from "../../../platform/auth/auth.types";
import { PrismaService } from "../../../platform/database/prisma.service";
import { AccessAuditService } from "../../access/access-audit.service";
import type { IssuerSnapshot } from "../providers/fiscal-provider.adapter";
import {
  isBrazilianState,
  isValidCnpj,
  isValidStateRegistration,
  normalizeCnpj,
  normalizeDigits,
} from "./br-documents";
import { UpdateFiscalIssuerDto } from "./dto/fiscal-configuration.dto";
import { IbgeMunicipalityClient } from "./ibge-municipality.client";

const REQUIRED_ADDRESS_FIELDS = ["street", "number", "neighborhood", "city", "state", "postalCode"] as const;

export function readStoreAddress(config: unknown): FiscalAddress {
  const address =
    config && typeof config === "object" && "address" in config
      ? ((config as { address?: Record<string, unknown> | null }).address ?? {})
      : {};
  const text = (key: string) => {
    const value = address?.[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };
  const state = text("state")?.toUpperCase() ?? null;
  const postalCode = text("postalCode");
  return {
    street: text("street"),
    number: text("number"),
    complement: text("complement"),
    neighborhood: text("neighborhood"),
    city: text("city"),
    state,
    postalCode: postalCode ? normalizeDigits(postalCode) : null,
  };
}

export function missingAddressFields(address: FiscalAddress): Array<keyof FiscalAddress> {
  const missing: Array<keyof FiscalAddress> = REQUIRED_ADDRESS_FIELDS.filter((field) => !address[field]);
  if (address.state && !isBrazilianState(address.state) && !missing.includes("state")) missing.push("state");
  if (address.postalCode && address.postalCode.length !== 8 && !missing.includes("postalCode")) {
    missing.push("postalCode");
  }
  return missing;
}

/** Issuer data: the store profile address is the single source; fiscal identity lives here. */
@Injectable()
export class FiscalIssuerService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(IbgeMunicipalityClient) private readonly ibge: IbgeMunicipalityClient,
    @Inject(AccessAuditService) private readonly audit: AccessAuditService
  ) {}

  async address(tenantId: string): Promise<FiscalAddress> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { config: true } });
    return readStoreAddress(tenant?.config);
  }

  async get(tenantId: string): Promise<FiscalIssuerView | null> {
    const issuer = await this.prisma.fiscalIssuer.findUnique({ where: { tenantId } });
    if (!issuer) return null;
    return {
      legalName: issuer.legalName,
      tradeName: issuer.tradeName,
      cnpj: issuer.cnpj,
      stateRegistration: issuer.stateRegistration,
      taxRegime: issuer.taxRegime,
      municipalityIbgeCode: issuer.municipalityIbgeCode,
      municipalityIbgeSource: (issuer.municipalityIbgeSource as FiscalIssuerView["municipalityIbgeSource"]) ?? null,
    };
  }

  async update(user: AuthUser, dto: UpdateFiscalIssuerDto): Promise<FiscalIssuerView> {
    const address = await this.address(user.tenantId);
    if (!address.state || !isBrazilianState(address.state)) {
      throw new UnprocessableEntityException({
        code: "ADDRESS_INCOMPLETE",
        message: "Informe a UF no endereco da loja antes dos dados fiscais",
      });
    }
    const cnpj = normalizeCnpj(dto.cnpj);
    if (!isValidCnpj(cnpj)) {
      throw new UnprocessableEntityException({ code: "INVALID_CNPJ", message: "CNPJ invalido" });
    }
    const stateRegistration = normalizeDigits(dto.stateRegistration);
    if (!isValidStateRegistration(stateRegistration, address.state)) {
      throw new UnprocessableEntityException({
        code: "INVALID_STATE_REGISTRATION",
        message: `Inscricao estadual invalida para ${address.state}`,
      });
    }
    let municipalityIbgeCode = dto.municipalityIbgeCode ?? null;
    let municipalityIbgeSource: "IBGE_API" | "MANUAL" = "MANUAL";
    if (!municipalityIbgeCode) {
      municipalityIbgeCode = address.city ? await this.ibge.resolve(address.city, address.state) : null;
      municipalityIbgeSource = "IBGE_API";
      if (!municipalityIbgeCode) {
        throw new UnprocessableEntityException({
          code: "IBGE_NOT_RESOLVED",
          message: "Nao foi possivel identificar o codigo IBGE do municipio; informe-o manualmente",
        });
      }
    }

    const before = await this.prisma.fiscalIssuer.findUnique({ where: { tenantId: user.tenantId } });
    const data = {
      legalName: dto.legalName,
      tradeName: dto.tradeName?.trim() || null,
      cnpj,
      stateRegistration,
      taxRegime: dto.taxRegime,
      municipalityIbgeCode,
      municipalityIbgeSource,
      updatedByUserId: user.id,
    };
    await this.prisma.fiscalIssuer.upsert({
      where: { tenantId: user.tenantId },
      create: { tenantId: user.tenantId, ...data },
      update: data,
    });
    await this.audit.record({
      actorUserId: user.id,
      storeId: user.tenantId,
      eventType: AccessAuditEventType.FISCAL_CONFIGURATION_CHANGED,
      result: AccessAuditResult.SUCCESS,
      metadata: {
        section: "issuer",
        before: before
          ? { legalName: before.legalName, stateRegistration: before.stateRegistration, ibge: before.municipalityIbgeCode }
          : null,
        after: { legalName: data.legalName, stateRegistration, ibge: municipalityIbgeCode },
      },
    });
    return (await this.get(user.tenantId)) as FiscalIssuerView;
  }

  /** Issuer + address frozen into each document. Null when anything required is missing. */
  async snapshot(tenantId: string): Promise<IssuerSnapshot | null> {
    const [issuer, tenant] = await Promise.all([
      this.prisma.fiscalIssuer.findUnique({ where: { tenantId } }),
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, config: true } }),
    ]);
    if (!issuer || !tenant || !issuer.municipalityIbgeCode) return null;
    const address = readStoreAddress(tenant.config);
    if (missingAddressFields(address).length > 0) return null;
    return {
      legalName: issuer.legalName,
      tradeName: issuer.tradeName ?? tenant.name,
      cnpj: issuer.cnpj,
      stateRegistration: issuer.stateRegistration,
      taxRegime: issuer.taxRegime,
      address: {
        street: address.street as string,
        number: address.number as string,
        complement: address.complement,
        neighborhood: address.neighborhood as string,
        city: address.city as string,
        state: address.state as string,
        postalCode: address.postalCode as string,
        municipalityIbgeCode: issuer.municipalityIbgeCode,
      },
    };
  }
}
