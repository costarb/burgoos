import { Injectable, Logger } from "@nestjs/common";

const IBGE_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/estados";
const TIMEOUT_MS = 5_000;

type Fetcher = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

export function normalizeMunicipalityName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Resolves the 7-digit IBGE municipality code from city + state using the public IBGE API. */
@Injectable()
export class IbgeMunicipalityClient {
  private readonly logger = new Logger(IbgeMunicipalityClient.name);
  private readonly cache = new Map<string, Map<string, string>>();
  private fetcher: Fetcher = (url, init) => fetch(url, init);

  /** Test seam. */
  useFetcher(fetcher: Fetcher): void {
    this.fetcher = fetcher;
    this.cache.clear();
  }

  async resolve(city: string, state: string): Promise<string | null> {
    const uf = state.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(uf) || !city.trim()) return null;
    try {
      const municipalities = await this.municipalities(uf);
      return municipalities.get(normalizeMunicipalityName(city)) ?? null;
    } catch (error) {
      this.logger.warn(
        JSON.stringify({ event: "fiscal.ibge.lookup_failed", state: uf, reason: (error as Error).message })
      );
      return null;
    }
  }

  private async municipalities(uf: string): Promise<Map<string, string>> {
    const cached = this.cache.get(uf);
    if (cached) return cached;
    const response = await this.fetcher(`${IBGE_URL}/${uf}/municipios`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error("IBGE indisponivel");
    const body = await response.json();
    if (!Array.isArray(body)) throw new Error("Resposta inesperada do IBGE");
    const map = new Map<string, string>();
    for (const item of body as Array<{ id?: unknown; nome?: unknown }>) {
      if (typeof item.nome === "string" && (typeof item.id === "number" || typeof item.id === "string")) {
        map.set(normalizeMunicipalityName(item.nome), String(item.id).padStart(7, "0"));
      }
    }
    this.cache.set(uf, map);
    return map;
  }
}
