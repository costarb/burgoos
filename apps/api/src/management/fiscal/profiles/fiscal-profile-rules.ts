/** CSOSN codes accepted for Simples Nacional on NFC-e in this phase. */
export const SIMPLES_CSOSN = ["101", "102", "103", "300", "400", "500", "900"] as const;
/** CSOSN codes for goods under tax substitution, which require CEST. */
export const CSOSN_REQUIRING_CEST = ["500"] as const;

export interface FiscalProfileInput {
  name: string;
  ncm: string;
  cfop: string;
  csosn: string;
  origin: number;
  commercialUnit: string;
  cest?: string | null;
  benefitCode?: string | null;
}

export interface NormalizedFiscalProfile {
  name: string;
  ncm: string;
  cfop: string;
  csosn: string;
  origin: number;
  commercialUnit: string;
  cest: string | null;
  benefitCode: string | null;
}

const digits = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "");

/** Returns the normalized profile or the list of validation messages. */
export function validateFiscalProfile(
  input: FiscalProfileInput
): { ok: true; value: NormalizedFiscalProfile } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const name = input.name.trim();
  const ncm = digits(input.ncm);
  const cfop = digits(input.cfop);
  const csosn = digits(input.csosn);
  const cest = digits(input.cest) || null;
  const commercialUnit = input.commercialUnit.trim().toUpperCase();
  const benefitCode = input.benefitCode?.trim().toUpperCase() || null;

  if (name.length < 2 || name.length > 80) errors.push("Nome deve ter entre 2 e 80 caracteres");
  if (!/^\d{8}$/.test(ncm)) errors.push("NCM deve ter 8 digitos");
  if (!/^5\d{3}$/.test(cfop)) errors.push("CFOP da NFC-e deve ser de saida interna (5xxx)");
  if (!(SIMPLES_CSOSN as readonly string[]).includes(csosn)) {
    errors.push(`CSOSN deve ser um de ${SIMPLES_CSOSN.join(", ")} (Simples Nacional)`);
  }
  if (!Number.isInteger(input.origin) || input.origin < 0 || input.origin > 8) {
    errors.push("Origem da mercadoria deve estar entre 0 e 8");
  }
  if (!/^[A-Z0-9]{1,6}$/.test(commercialUnit)) errors.push("Unidade comercial deve ter ate 6 letras ou numeros");
  if (cest !== null && !/^\d{7}$/.test(cest)) errors.push("CEST deve ter 7 digitos");
  if ((CSOSN_REQUIRING_CEST as readonly string[]).includes(csosn) && cest === null) {
    errors.push(`CEST e obrigatorio para o CSOSN ${csosn}`);
  }
  if (benefitCode !== null && !/^[A-Z0-9]{8,10}$/.test(benefitCode)) {
    errors.push("Codigo de beneficio fiscal (cBenef) invalido");
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { name, ncm, cfop, csosn, origin: input.origin, commercialUnit, cest, benefitCode } };
}
