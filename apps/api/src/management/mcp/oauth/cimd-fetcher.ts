import { Injectable } from "@nestjs/common";
import { lookup } from "dns/promises";
import { isIP } from "net";
import { isAllowedRedirectUri } from "./redirect-uri";

export interface ClientMetadataDocument {
  clientId: string;
  clientName: string | null;
  redirectUris: string[];
}

export class CimdFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CimdFetchError";
  }
}

const TIMEOUT_MS = 5_000;
const MAX_BYTES = 64 * 1024;

type LookupFn = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

/**
 * Fetches an OAuth Client ID Metadata Document. The client_id is attacker-controlled, so the
 * request is restricted to public HTTPS hosts, no redirects, a short timeout and a small body.
 */
@Injectable()
export class CimdFetcher {
  fetchImpl: typeof fetch = (input, init) => fetch(input, init);
  lookupImpl: LookupFn = (hostname) => lookup(hostname, { all: true, verbatim: true });

  async fetch(clientId: string): Promise<ClientMetadataDocument> {
    const url = parseUrl(clientId);
    await this.assertPublicHost(url.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
    } catch {
      throw new CimdFetchError("Nao foi possivel obter a identificacao do aplicativo.");
    } finally {
      clearTimeout(timer);
    }

    if (response.status !== 200) {
      throw new CimdFetchError(`A identificacao do aplicativo respondeu ${response.status}.`);
    }
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_BYTES) throw new CimdFetchError("Identificacao do aplicativo muito grande.");
    const body = Buffer.from(await response.arrayBuffer());
    if (body.byteLength > MAX_BYTES) throw new CimdFetchError("Identificacao do aplicativo muito grande.");

    let document: Record<string, unknown>;
    try {
      document = JSON.parse(body.toString("utf8")) as Record<string, unknown>;
    } catch {
      throw new CimdFetchError("Identificacao do aplicativo invalida.");
    }
    return validateDocument(document, url.toString());
  }

  private async assertPublicHost(hostname: string): Promise<void> {
    const host = hostname.replace(/^\[|\]$/g, "");
    let addresses: string[];
    if (isIP(host)) addresses = [host];
    else {
      try {
        addresses = (await this.lookupImpl(host)).map((entry) => entry.address);
      } catch {
        throw new CimdFetchError("Endereco do aplicativo nao encontrado.");
      }
    }
    if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
      throw new CimdFetchError("Endereco do aplicativo nao permitido.");
    }
  }
}

function parseUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new CimdFetchError("Identificador do aplicativo invalido.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.pathname === "/") {
    throw new CimdFetchError("Identificador do aplicativo invalido.");
  }
  return url;
}

function validateDocument(document: Record<string, unknown>, url: string): ClientMetadataDocument {
  if (document.client_id !== url) {
    throw new CimdFetchError("A identificacao do aplicativo nao corresponde ao endereco informado.");
  }
  const redirectUris = Array.isArray(document.redirect_uris)
    ? document.redirect_uris.filter((item): item is string => typeof item === "string")
    : [];
  if (redirectUris.length === 0 || !redirectUris.every(isAllowedRedirectUri)) {
    throw new CimdFetchError("O aplicativo nao declarou enderecos de retorno validos.");
  }
  const clientName =
    typeof document.client_name === "string" && document.client_name.trim()
      ? document.client_name.trim().slice(0, 120)
      : null;
  return { clientId: url, clientName, redirectUris };
}

/** Loopback, private, link-local, CGNAT, unique-local and unspecified ranges. */
export function isPrivateAddress(address: string): boolean {
  const value = address.toLowerCase();
  if (isIP(value) === 4) {
    const [a, b] = value.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  if (value === "::" || value === "::1") return true;
  if (value.startsWith("::ffff:")) return isPrivateAddress(value.slice(7));
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(value);
}
