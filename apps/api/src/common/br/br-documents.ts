const CNPJ_FIRST_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_SECOND_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export const BRAZILIAN_STATES = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA",
  "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const;

export type BrazilianState = (typeof BRAZILIAN_STATES)[number];

export function isBrazilianState(value: string): value is BrazilianState {
  return (BRAZILIAN_STATES as readonly string[]).includes(value);
}

/** Uppercases and strips punctuation. Letters are kept for the alphanumeric CNPJ (IN RFB 2.229/2024). */
export function normalizeCnpj(value: string): string {
  return value.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

export function normalizeDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Validates numeric and alphanumeric CNPJ. Each character is worth its ASCII code minus 48,
 * so digits keep their value and letters start at 17 ("A"); check digits are always numeric.
 */
export function isValidCnpj(value: string): boolean {
  const cnpj = normalizeCnpj(value);
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj)) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const values = [...cnpj].map((char) => char.charCodeAt(0) - 48);
  const first = cnpjCheckDigit(values.slice(0, 12), CNPJ_FIRST_WEIGHTS);
  const second = cnpjCheckDigit([...values.slice(0, 12), first], CNPJ_SECOND_WEIGHTS);
  return values[12] === first && values[13] === second;
}

function cnpjCheckDigit(values: number[], weights: number[]): number {
  const remainder = values.reduce((sum, value, index) => sum + value * weights[index], 0) % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCpf(value: string): boolean {
  const cpf = normalizeDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digits = [...cpf].map(Number);
  const check = (length: number) => {
    const sum = digits
      .slice(0, length)
      .reduce((total, digit, index) => total + digit * (length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return check(9) === digits[9] && check(10) === digits[10];
}

/** Consumer identification on the NFC-e: CPF (11) or CNPJ (14, possibly alphanumeric). */
export function normalizeConsumerDocument(value: string): string | null {
  const normalized = normalizeCnpj(value);
  if (normalized.length === 11 && isValidCpf(normalized)) return normalized;
  if (normalized.length === 14 && isValidCnpj(normalized)) return normalized;
  return null;
}

/**
 * State registration. SP uses the full SEFAZ-SP algorithm for the 12-digit commercial
 * registration; other states only get a format check until they are piloted.
 */
export function isValidStateRegistration(value: string, state: string): boolean {
  const ie = normalizeDigits(value);
  if (state === "SP") return isValidSpStateRegistration(ie);
  return ie.length >= 2 && ie.length <= 14 && !/^0+$/.test(ie);
}

function isValidSpStateRegistration(ie: string): boolean {
  if (!/^\d{12}$/.test(ie)) return false;
  const digits = [...ie].map(Number);
  const firstWeights = [1, 3, 4, 5, 6, 7, 8, 10];
  const first =
    (digits.slice(0, 8).reduce((sum, digit, index) => sum + digit * firstWeights[index], 0) % 11) %
    10;
  if (digits[8] !== first) return false;
  const secondWeights = [3, 2, 10, 9, 8, 7, 6, 5, 4, 3, 2];
  const second =
    (digits.slice(0, 11).reduce((sum, digit, index) => sum + digit * secondWeights[index], 0) %
      11) %
    10;
  return digits[11] === second;
}

/** Keeps only the last digits visible, for logs and list responses. */
export function maskDocument(value: string | null | undefined): string | null {
  if (!value) return null;
  const visible = value.length === 11 ? 2 : 4;
  return `${"*".repeat(value.length - visible)}${value.slice(-visible)}`;
}
