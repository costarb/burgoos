import type { FiscalProvider } from "@prisma/client";
import {
  FiscalProviderAdapter,
  FiscalProviderCapabilities,
  FiscalProviderError,
  NfceDraft,
  ProviderContext,
  ProviderDocumentState,
} from "../fiscal-provider.adapter";

export type FakeSubmitOutcome = "AUTHORIZE" | "PROCESSING" | "REJECT" | "UNAVAILABLE";

/**
 * Scriptable provider for tests: each call consumes the next scripted outcome (or the default).
 * Keeps created documents in memory so `findByReference` and `get` behave like a real provider.
 */
export class FakeFiscalProviderAdapter implements FiscalProviderAdapter {
  readonly calls: Array<{ method: string; externalId?: string; reference?: string }> = [];
  readonly documents = new Map<string, { draft: NfceDraft; state: ProviderDocumentState }>();
  createOutcomes: Array<"OK" | "TIMEOUT_AFTER_CREATE" | "TIMEOUT_BEFORE_CREATE" | "UNAVAILABLE"> = [];
  submitOutcomes: FakeSubmitOutcome[] = [];
  defaultSubmit: FakeSubmitOutcome = "AUTHORIZE";
  private sequence = 0;

  constructor(
    readonly capabilities: FiscalProviderCapabilities = { cancelViaApi: false, usesOwnCertificate: false },
    readonly provider: FiscalProvider = "BLING"
  ) {}

  async create(_ctx: ProviderContext, draft: NfceDraft): Promise<{ externalId: string }> {
    this.calls.push({ method: "create", reference: draft.reference });
    const outcome = this.createOutcomes.shift() ?? "OK";
    if (outcome === "UNAVAILABLE") throw new FiscalProviderError("UNAVAILABLE", "fora do ar", true);
    if (outcome === "TIMEOUT_BEFORE_CREATE") throw new FiscalProviderError("TIMEOUT", "timeout", true);
    const externalId = `fake-${++this.sequence}`;
    this.documents.set(externalId, { draft, state: { status: "PROCESSING", externalId } });
    if (outcome === "TIMEOUT_AFTER_CREATE") throw new FiscalProviderError("TIMEOUT", "timeout", true);
    return { externalId };
  }

  async submit(_ctx: ProviderContext, externalId: string): Promise<ProviderDocumentState> {
    this.calls.push({ method: "submit", externalId });
    const stored = this.require(externalId);
    if (stored.state.status === "AUTHORIZED") return stored.state;
    const outcome = this.submitOutcomes.shift() ?? this.defaultSubmit;
    if (outcome === "UNAVAILABLE") throw new FiscalProviderError("UNAVAILABLE", "fora do ar", true);
    stored.state =
      outcome === "AUTHORIZE"
        ? this.authorized(externalId)
        : outcome === "PROCESSING"
          ? { status: "PROCESSING", externalId }
          : { status: "REJECTED", externalId, code: "778", message: "NCM inexistente" };
    return stored.state;
  }

  async get(_ctx: ProviderContext, externalId: string): Promise<ProviderDocumentState> {
    this.calls.push({ method: "get", externalId });
    return this.require(externalId).state;
  }

  async findByReference(_ctx: ProviderContext, draft: NfceDraft) {
    this.calls.push({ method: "findByReference", reference: draft.reference });
    for (const [externalId, stored] of this.documents) {
      if (stored.draft.reference === draft.reference) return { externalId };
    }
    return null;
  }

  async cancel(_ctx: ProviderContext, externalId: string, _reason: string): Promise<ProviderDocumentState> {
    this.calls.push({ method: "cancel", externalId });
    if (!this.capabilities.cancelViaApi) {
      throw new FiscalProviderError("NOT_SUPPORTED", "cancelamento indisponivel", false);
    }
    const stored = this.require(externalId);
    stored.state = { status: "CANCELLED", externalId, cancelledAt: new Date().toISOString(), protocol: "135000000000001" };
    return stored.state;
  }

  async downloadXml(_ctx: ProviderContext, externalId: string, kind: "AUTHORIZATION" | "CANCELLATION") {
    this.calls.push({ method: `downloadXml:${kind}`, externalId });
    return Buffer.from(`<nfeProc id="${externalId}" kind="${kind}"/>`);
  }

  async downloadDanfe(_ctx: ProviderContext, externalId: string) {
    this.calls.push({ method: "downloadDanfe", externalId });
    return Buffer.from(`%PDF-fake ${externalId}`);
  }

  panelUrl(externalId: string) {
    return `https://provider.test/nfce/${externalId}`;
  }

  /** Simulates a cancellation done directly in the provider panel. */
  cancelExternally(externalId: string) {
    const stored = this.require(externalId);
    stored.state = { status: "CANCELLED", externalId, cancelledAt: new Date().toISOString(), protocol: "135000000000002" };
  }

  private authorized(externalId: string): ProviderDocumentState {
    const number = Number(externalId.replace(/\D/g, "")) || 1;
    return {
      status: "AUTHORIZED",
      externalId,
      number,
      series: 1,
      accessKey: `3526101122233300018165001${String(number).padStart(19, "0")}`.slice(0, 44),
      protocol: "135000000000000",
      authorizedAt: new Date().toISOString(),
      qrCodeUrl: `https://sefaz.test/qr/${externalId}`,
      consultationUrl: "https://www.nfce.fazenda.sp.gov.br/consulta",
      danfeUrl: `https://provider.test/danfe/${externalId}`,
    };
  }

  private require(externalId: string) {
    const stored = this.documents.get(externalId);
    if (!stored) throw new FiscalProviderError("VALIDATION", "documento inexistente", false);
    return stored;
  }
}
