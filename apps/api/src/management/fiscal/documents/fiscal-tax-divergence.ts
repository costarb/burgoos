import type { NfceDraftItem } from "../providers/fiscal-provider.adapter";
import type { FiscalTaxDivergence } from "../fiscal.types";

export interface AuthorizedItemTaxes {
  code: string | null;
  cfop: string | null;
  /** Simples Nacional CSOSN; null when the note carries a regular-regime CST. */
  csosn: string | null;
}

const first = (block: string, name: string): string | null => block.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1] ?? null;

/** CFOP/CSOSN of each `<det>` of an authorized NFC-e XML, in item order. */
export function authorizedItemTaxes(xml: string): AuthorizedItemTaxes[] {
  return [...xml.matchAll(/<det\b[^>]*>([\s\S]*?)<\/det>/g)].map((match) => ({
    code: first(match[1], "cProd"),
    cfop: first(match[1], "CFOP"),
    csosn: first(match[1], "CSOSN"),
  }));
}

/**
 * Items whose authorized taxes differ from what the ERP fiscal profile asked for. Items are matched by
 * position (the provider keeps the order sent); a different item count means the XML cannot be compared.
 */
export function compareItemTaxes(items: NfceDraftItem[], authorized: AuthorizedItemTaxes[]): FiscalTaxDivergence[] {
  if (!items.length || items.length !== authorized.length) return [];
  return items.flatMap((item, index) => {
    const actual = authorized[index];
    if (actual.cfop === item.cfop && actual.csosn === item.csosn) return [];
    return [
      {
        code: item.code,
        description: item.description,
        ncm: item.ncm,
        expected: { cfop: item.cfop, csosn: item.csosn },
        actual: { cfop: actual.cfop, csosn: actual.csosn },
      },
    ];
  });
}
