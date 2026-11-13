import { Inject, Injectable } from "@nestjs/common";
import { BlingPlatformConfigurationService } from "../../../../platform/integrations/bling-platform-configuration.service";
import { FiscalProviderError } from "../fiscal-provider.adapter";

/** Bling allows ~3 requests/second per account: calls of a tenant are serialized and spaced. */
const MIN_INTERVAL_MS = 350;
const TIMEOUT_MS = 20_000;

export type BlingFetcher = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

interface BlingErrorBody {
  error?: {
    type?: string;
    message?: string;
    description?: string;
    fields?: Array<{ msg?: string; element?: string; collection?: Array<{ msg?: string }> }>;
  };
}

@Injectable()
export class BlingClient {
  private fetcher: BlingFetcher = (url, init) => fetch(url, init);
  private readonly queues = new Map<string, Promise<unknown>>();
  private readonly lastCall = new Map<string, number>();
  intervalMs = MIN_INTERVAL_MS;

  constructor(@Inject(BlingPlatformConfigurationService) private readonly platform: BlingPlatformConfigurationService) {}

  /** Test seam. */
  useFetcher(fetcher: BlingFetcher): void {
    this.fetcher = fetcher;
  }

  get<T>(tenantId: string, accessToken: string, path: string): Promise<T> {
    return this.request<T>(tenantId, accessToken, "GET", path);
  }

  post<T>(tenantId: string, accessToken: string, path: string, body?: unknown): Promise<T> {
    return this.request<T>(tenantId, accessToken, "POST", path, body);
  }

  /** Signed Bling document URLs (XML) need no bearer token. */
  async download(url: string): Promise<Buffer> {
    let response: Awaited<ReturnType<BlingFetcher>>;
    try {
      response = await this.fetcher(url, { method: "GET", headers: {}, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new FiscalProviderError("UNAVAILABLE", "Falha ao baixar documento do Bling", true);
    }
    if (!response.ok) throw new FiscalProviderError("UNAVAILABLE", `Download do Bling falhou (${response.status})`, response.status >= 500);
    return Buffer.from(await response.text(), "utf8");
  }

  private request<T>(tenantId: string, accessToken: string, method: string, path: string, body?: unknown): Promise<T> {
    const previous = this.queues.get(tenantId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(() => this.send<T>(tenantId, accessToken, method, path, body));
    this.queues.set(tenantId, next.catch(() => undefined));
    return next;
  }

  private async send<T>(tenantId: string, accessToken: string, method: string, path: string, body?: unknown): Promise<T> {
    const wait = (this.lastCall.get(tenantId) ?? 0) + this.intervalMs - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    this.lastCall.set(tenantId, Date.now());
    const base = (await this.platform.value("apiBaseUrl"))?.replace(/\/$/, "") ?? "https://api.bling.com.br/Api/v3";
    let response: Awaited<ReturnType<BlingFetcher>>;
    try {
      response = await this.fetcher(`${base}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      const timeout = (error as Error)?.name === "TimeoutError" || (error as Error)?.name === "AbortError";
      throw new FiscalProviderError(timeout ? "TIMEOUT" : "UNAVAILABLE", timeout ? "Tempo esgotado no Bling" : "Bling indisponivel", true);
    }
    const text = await response.text();
    const parsed = parseJson(text);
    if (response.ok) return parsed as T;
    if (response.status === 401 || response.status === 403) {
      throw new FiscalProviderError("AUTHENTICATION", "Acesso ao Bling recusado", false, "PROVIDER_DISCONNECTED");
    }
    if (response.status === 429) throw new FiscalProviderError("RATE_LIMIT", "Limite de requisicoes do Bling", true);
    if (response.status >= 500) throw new FiscalProviderError("UNAVAILABLE", `Bling indisponivel (${response.status})`, true);
    throw new FiscalProviderError("VALIDATION", blingErrorMessage(parsed as BlingErrorBody) ?? `Bling recusou a requisicao (${response.status})`, false, `BLING_${response.status}`);
  }
}

function parseJson(text: string): unknown {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

/** "Nao foi possivel salvar: Id da forma de pagamento invalido (parcelas)". */
export function blingErrorMessage(body: BlingErrorBody | null | undefined): string | null {
  const error = body?.error;
  if (!error) return null;
  const details = (error.fields ?? []).flatMap((field) =>
    field.collection?.length ? field.collection.map((item) => item.msg).filter(Boolean) : [field.msg]
  );
  const message = [error.message, ...details].filter(Boolean).join(": ");
  return message ? message.slice(0, 500) : (error.description ?? null);
}
