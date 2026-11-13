import { Inject, Injectable } from "@nestjs/common";
import { isBrazilianState } from "../../../common/br/br-documents";
import { PrismaService } from "../../../platform/database/prisma.service";
import { readStoreAddress } from "../../../platform/stores/store-legal-profile.service";
import type { FiscalAddress, FiscalIssuerView } from "../fiscal.types";
import type { IssuerSnapshot } from "../providers/fiscal-provider.adapter";

const REQUIRED_ADDRESS_FIELDS = ["street", "number", "neighborhood", "city", "state", "postalCode"] as const;

export function missingAddressFields(address: FiscalAddress): Array<keyof FiscalAddress> {
  const missing: Array<keyof FiscalAddress> = REQUIRED_ADDRESS_FIELDS.filter((field) => !address[field]);
  if (address.state && !isBrazilianState(address.state) && !missing.includes("state")) missing.push("state");
  if (address.postalCode && address.postalCode.length !== 8 && !missing.includes("postalCode")) {
    missing.push("postalCode");
  }
  return missing;
}

const ISSUER_SELECT = {
  name: true,
  config: true,
  legalName: true,
  tradeName: true,
  cnpj: true,
  stateRegistration: true,
  taxRegime: true,
  municipalityIbgeCode: true,
  municipalityIbgeSource: true,
} as const;

/**
 * The issuer is the store itself (FR-002): fiscal identity and address come from the store
 * registration, edited in "Dados da loja" (store admin) or on the platform store form.
 */
@Injectable()
export class FiscalIssuerService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async address(tenantId: string): Promise<FiscalAddress> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { config: true } });
    return readStoreAddress(tenant?.config);
  }

  /** Null until the store has the minimum fiscal identity (legal name, CNPJ and state registration). */
  async get(tenantId: string): Promise<FiscalIssuerView | null> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: ISSUER_SELECT });
    if (!tenant?.legalName || !tenant.cnpj || !tenant.stateRegistration) return null;
    return {
      legalName: tenant.legalName,
      tradeName: tenant.tradeName,
      cnpj: tenant.cnpj,
      stateRegistration: tenant.stateRegistration,
      taxRegime: tenant.taxRegime ?? "SIMPLES_NACIONAL",
      municipalityIbgeCode: tenant.municipalityIbgeCode,
      municipalityIbgeSource: (tenant.municipalityIbgeSource as FiscalIssuerView["municipalityIbgeSource"]) ?? null,
    };
  }

  /** Issuer + address frozen into each document. Null when anything required is missing. */
  async snapshot(tenantId: string): Promise<IssuerSnapshot | null> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: ISSUER_SELECT });
    if (!tenant?.legalName || !tenant.cnpj || !tenant.stateRegistration || !tenant.municipalityIbgeCode) return null;
    const address = readStoreAddress(tenant.config);
    if (missingAddressFields(address).length > 0) return null;
    return {
      legalName: tenant.legalName,
      tradeName: tenant.tradeName ?? tenant.name,
      cnpj: tenant.cnpj,
      stateRegistration: tenant.stateRegistration,
      taxRegime: tenant.taxRegime ?? "SIMPLES_NACIONAL",
      address: {
        street: address.street as string,
        number: address.number as string,
        complement: address.complement,
        neighborhood: address.neighborhood as string,
        city: address.city as string,
        state: address.state as string,
        postalCode: address.postalCode as string,
        municipalityIbgeCode: tenant.municipalityIbgeCode,
      },
    };
  }
}
