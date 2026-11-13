import { Inject, Injectable, UnprocessableEntityException } from "@nestjs/common";
import type { FiscalTaxRegime, Prisma } from "@prisma/client";
import {
  isBrazilianState,
  isValidCnpj,
  isValidStateRegistration,
  normalizeCnpj,
  normalizeDigits,
} from "../../common/br/br-documents";
import { IbgeMunicipalityClient } from "../../common/br/ibge-municipality.client";

export interface StoreAddressFields {
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
}

export interface StoreLegalFields {
  legalName: string | null;
  tradeName: string | null;
  cnpj: string | null;
  stateRegistration: string | null;
  taxRegime: FiscalTaxRegime | null;
  municipalityIbgeCode: string | null;
  municipalityIbgeSource: string | null;
}

/** Fields accepted from the platform form and from the store admin "Dados da loja" screen. */
export interface StoreLegalInput {
  legalName?: string | null;
  tradeName?: string | null;
  cnpj?: string | null;
  stateRegistration?: string | null;
  taxRegime?: FiscalTaxRegime | null;
  municipalityIbgeCode?: string | null;
}

const LEGAL_KEYS = ["legalName", "tradeName", "cnpj", "stateRegistration", "taxRegime", "municipalityIbgeCode"] as const;

/** Address saved by the store registration (`config.storeProfile.address`). */
export function readStoreAddress(config: Prisma.JsonValue | unknown): StoreAddressFields {
  const root = config && typeof config === "object" && !Array.isArray(config) ? (config as Record<string, unknown>) : {};
  const profile = root.storeProfile && typeof root.storeProfile === "object" ? (root.storeProfile as Record<string, unknown>) : {};
  const address = profile.address && typeof profile.address === "object" ? (profile.address as Record<string, unknown>) : {};
  const text = (key: string) => {
    const value = address[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };
  const postalCode = text("postalCode");
  return {
    street: text("street"),
    number: text("number"),
    complement: text("complement"),
    neighborhood: text("neighborhood"),
    city: text("city"),
    state: text("state")?.toUpperCase() ?? null,
    postalCode: postalCode ? normalizeDigits(postalCode) : null,
  };
}

export function readStoreLegal(store: Partial<StoreLegalFields>): StoreLegalFields {
  return {
    legalName: store.legalName ?? null,
    tradeName: store.tradeName ?? null,
    cnpj: store.cnpj ?? null,
    stateRegistration: store.stateRegistration ?? null,
    taxRegime: store.taxRegime ?? null,
    municipalityIbgeCode: store.municipalityIbgeCode ?? null,
    municipalityIbgeSource: store.municipalityIbgeSource ?? null,
  };
}

const invalid = (code: string, message: string) => new UnprocessableEntityException({ code, message });

/**
 * Validates the store fiscal identity against the (next) store address: CNPJ check digits
 * (including the alphanumeric CNPJ), state registration for the address state, and the IBGE
 * municipality code resolved from city/state unless typed manually.
 */
@Injectable()
export class StoreLegalProfileService {
  constructor(@Inject(IbgeMunicipalityClient) private readonly ibge: IbgeMunicipalityClient) {}

  hasLegalInput(input: StoreLegalInput): boolean {
    return LEGAL_KEYS.some((key) => input[key] !== undefined);
  }

  /**
   * Returns the columns to persist. `addressChanged` forces a new IBGE lookup when the city or
   * state may have changed and the code was not typed manually.
   */
  async resolve(
    current: StoreLegalFields,
    input: StoreLegalInput,
    address: StoreAddressFields,
    addressChanged: boolean
  ): Promise<Partial<StoreLegalFields>> {
    const data: Partial<StoreLegalFields> = {};
    const text = (value: string | null | undefined) => (value === undefined ? undefined : value?.trim() || null);

    if (input.legalName !== undefined) data.legalName = text(input.legalName) ?? null;
    if (input.tradeName !== undefined) data.tradeName = text(input.tradeName) ?? null;
    if (input.taxRegime !== undefined) data.taxRegime = input.taxRegime ?? null;

    if (input.cnpj !== undefined) {
      const cnpj = input.cnpj ? normalizeCnpj(input.cnpj) : null;
      if (cnpj && !isValidCnpj(cnpj)) throw invalid("INVALID_CNPJ", "CNPJ invalido");
      data.cnpj = cnpj;
      if (cnpj && !current.taxRegime && input.taxRegime === undefined) data.taxRegime = "SIMPLES_NACIONAL";
    }

    const stateRegistration =
      input.stateRegistration !== undefined
        ? input.stateRegistration
          ? normalizeDigits(input.stateRegistration)
          : null
        : current.stateRegistration;
    if (stateRegistration && (input.stateRegistration !== undefined || addressChanged)) {
      if (!address.state || !isBrazilianState(address.state)) {
        throw invalid("ADDRESS_INCOMPLETE", "Informe a UF do endereco da loja para validar a inscricao estadual");
      }
      if (!isValidStateRegistration(stateRegistration, address.state)) {
        throw invalid("INVALID_STATE_REGISTRATION", `Inscricao estadual invalida para ${address.state}`);
      }
    }
    if (input.stateRegistration !== undefined) data.stateRegistration = stateRegistration;

    if (input.municipalityIbgeCode !== undefined && input.municipalityIbgeCode) {
      const code = normalizeDigits(input.municipalityIbgeCode);
      if (!/^\d{7}$/.test(code)) throw invalid("INVALID_IBGE_CODE", "Codigo IBGE deve ter 7 digitos");
      data.municipalityIbgeCode = code;
      data.municipalityIbgeSource = "MANUAL";
    } else {
      const cleared = input.municipalityIbgeCode !== undefined;
      const automatic = current.municipalityIbgeSource !== "MANUAL" || cleared;
      const needsLookup = cleared || !current.municipalityIbgeCode || (addressChanged && automatic);
      if (needsLookup && automatic && address.city && address.state) {
        const code = await this.ibge.resolve(address.city, address.state);
        data.municipalityIbgeCode = code;
        data.municipalityIbgeSource = code ? "IBGE_API" : null;
      } else if (cleared) {
        data.municipalityIbgeCode = null;
        data.municipalityIbgeSource = null;
      }
    }
    return data;
  }
}
