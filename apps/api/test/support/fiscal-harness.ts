import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { Readable } from "node:stream";
import type { AssetStorage } from "../../src/common/storage/asset-storage";
import { AccessAuditService } from "../../src/management/access/access-audit.service";
import { FiscalConfigurationService } from "../../src/management/fiscal/configuration/fiscal-configuration.service";
import { FiscalIssuerService } from "../../src/management/fiscal/configuration/fiscal-issuer.service";
import { FiscalReadinessService } from "../../src/management/fiscal/configuration/fiscal-readiness.service";
import { IbgeMunicipalityClient } from "../../src/management/fiscal/configuration/ibge-municipality.client";
import { FiscalAuditService } from "../../src/management/fiscal/documents/fiscal-audit.service";
import { FiscalCancellationService } from "../../src/management/fiscal/documents/fiscal-cancellation.service";
import { FiscalDocumentStateService } from "../../src/management/fiscal/documents/fiscal-document-state.service";
import { FiscalDocumentStorageService } from "../../src/management/fiscal/documents/fiscal-document-storage.service";
import { FiscalDocumentsService } from "../../src/management/fiscal/documents/fiscal-documents.service";
import { FiscalEmissionProcessor } from "../../src/management/fiscal/documents/fiscal-emission.processor";
import { FiscalEmissionService } from "../../src/management/fiscal/documents/fiscal-emission.service";
import { FiscalNotifierService } from "../../src/management/fiscal/documents/fiscal-notifier.service";
import { FiscalOrderGuardService } from "../../src/management/fiscal/documents/fiscal-order-guard.service";
import { FiscalSaleLoader } from "../../src/management/fiscal/documents/fiscal-sale.loader";
import { FiscalSyncService } from "../../src/management/fiscal/documents/fiscal-sync.service";
import { FiscalTriggerService } from "../../src/management/fiscal/documents/fiscal-trigger.service";
import { FiscalProfileResolver } from "../../src/management/fiscal/profiles/fiscal-profile-resolver";
import { FiscalProfileService } from "../../src/management/fiscal/profiles/fiscal-profile.service";
import type { FiscalProviderCapabilities } from "../../src/management/fiscal/providers/fiscal-provider.adapter";
import { FiscalProviderContextService } from "../../src/management/fiscal/providers/fiscal-provider-context.service";
import { FiscalProviderRegistry } from "../../src/management/fiscal/providers/fiscal-provider.registry";
import { FakeFiscalProviderAdapter } from "../../src/management/fiscal/providers/testing/fake-fiscal-provider.adapter";
import { NotificationsService } from "../../src/management/notifications/notifications.service";
import { IntegrationSecretService } from "../../src/security/integration-secret.service";
import { createFiscalFakePrisma } from "./fiscal-fake-prisma";

export const TENANT = "11111111-1111-4111-8111-111111111111";
export const OTHER_TENANT = "22222222-2222-4222-8222-222222222222";
export const OWNER_ID = "aaaaaaaa-0000-4000-8000-000000000001";
export const CATEGORY_ID = "c0000000-0000-4000-8000-00000000000a";
export const HOT_DOG = "p0000000-0000-4000-8000-00000000000a";
export const SODA = "p0000000-0000-4000-8000-00000000000c";
export const BACON = "b0000000-0000-4000-8000-00000000000a";
const PROFILE_ID = "f0000000-0000-4000-8000-00000000000a";

interface QueuedJob {
  id: string;
  tenantId: string | null;
  type: string;
  targetId: string;
  dedupeKey?: string;
  attempts: number;
  maxAttempts: number;
  done: boolean;
}

export function createFiscalHarness(options: { capabilities?: FiscalProviderCapabilities } = {}) {
  const secrets = new IntegrationSecretService(new ConfigService({ INTEGRATION_SECRET_KEY: Buffer.alloc(32, 9).toString("base64") }));
  const prisma = createFiscalFakePrisma({
    tenant: [
      { id: TENANT, name: "Dogao", config: { address: { street: "Rua Augusta", number: "100", neighborhood: "Consolacao", city: "Sao Paulo", state: "SP", postalCode: "01305000" } } },
      { id: OTHER_TENANT, name: "Outra", config: {} },
    ],
    user: [{ id: OWNER_ID, tenantId: TENANT, role: "OWNER", status: "ACTIVE", name: "Dono" }],
    fiscalIssuer: [
      { tenantId: TENANT, legalName: "Dogao LTDA", tradeName: null, cnpj: "11222333000181", stateRegistration: "110042490114", taxRegime: "SIMPLES_NACIONAL", municipalityIbgeCode: "3550308", municipalityIbgeSource: "IBGE_API" },
    ],
    fiscalConfiguration: [
      { tenantId: TENANT, enabled: true, provider: "BLING", environment: "HOMOLOGATION", series: 1, emissionMode: "AUTOMATIC", eligibleSources: ["COUNTER", "IMPORT", "API"], defaultCancelReason: "Venda cancelada a pedido do cliente", enabledAt: new Date() },
    ],
    fiscalProviderConnection: [
      {
        tenantId: TENANT,
        provider: "BLING",
        status: "CONNECTED",
        settings: {},
        credentialCiphertext: secrets.encryptEnvelope({ version: 1, kind: "BLING_OAUTH", accessToken: "access", refreshToken: "refresh" }),
        tokenExpiresAt: new Date(Date.now() + 3_600_000),
      },
    ],
    fiscalProfile: [{ id: PROFILE_ID, tenantId: TENANT, name: "Alimentacao", ncm: "21069090", cfop: "5102", csosn: "102", origin: 0, commercialUnit: "UN", active: true }],
    category: [{ id: CATEGORY_ID, tenantId: TENANT, name: "Lanches", fiscalProfileId: PROFILE_ID }],
    product: [
      { id: HOT_DOG, tenantId: TENANT, categoryId: CATEGORY_ID, name: "Hot Dog" },
      { id: SODA, tenantId: TENANT, categoryId: CATEGORY_ID, name: "Refrigerante" },
    ],
    productComplement: [{ id: BACON, tenantId: TENANT, name: "Bacon extra" }],
  });

  const files = new Map<string, Buffer>();
  const storage: AssetStorage = {
    createUploadIntent: async () => {
      throw new Error("not used");
    },
    write: async ({ key, body }) => {
      const chunks: Buffer[] = [];
      for await (const chunk of body) chunks.push(Buffer.from(chunk));
      files.set(key, Buffer.concat(chunks));
      return { sizeBytes: files.get(key)!.length };
    },
    read: async (key) => {
      const content = files.get(key);
      if (!content) throw new Error("missing");
      return { body: Readable.from(content) };
    },
    delete: async (key) => {
      files.delete(key);
    },
  };

  const queue: QueuedJob[] = [];
  const jobs = {
    enqueue: async (input: { tenantId?: string | null; type: string; targetId: string; dedupeKey?: string; maxAttempts?: number }) => {
      const active = queue.find((job) => !job.done && job.type === input.type && job.dedupeKey && job.dedupeKey === input.dedupeKey);
      if (active) return active;
      const job: QueuedJob = { id: randomUUID(), tenantId: input.tenantId ?? null, type: input.type, targetId: input.targetId, dedupeKey: input.dedupeKey, attempts: 0, maxAttempts: input.maxAttempts ?? 5, done: false };
      queue.push(job);
      return job;
    },
  };

  const fake = new FakeFiscalProviderAdapter(options.capabilities);
  const registry = new FiscalProviderRegistry();
  registry.register(fake);
  const audit = new FiscalAuditService(prisma as never);
  const logs: Array<Record<string, unknown>> = [];
  const originalLog = audit.log.bind(audit);
  audit.log = (event, fields, level) => {
    logs.push({ event, level: level ?? "log", ...fields });
    originalLog(event, fields, level);
  };
  const accessAudit = new AccessAuditService(prisma as never);
  const contexts = new FiscalProviderContextService(prisma as never, secrets);
  const documentStorage = new FiscalDocumentStorageService(storage);
  const notifier = new FiscalNotifierService(prisma as never, new NotificationsService(prisma as never));
  const states = new FiscalDocumentStateService(prisma as never, audit, documentStorage, registry, contexts);
  const cancellations = new FiscalCancellationService(prisma as never, registry, contexts, states, audit, notifier, jobs as never);
  const issuers = new FiscalIssuerService(prisma as never, new IbgeMunicipalityClient(), accessAudit);
  const profileService = new FiscalProfileService(prisma as never, accessAudit);
  const readiness = new FiscalReadinessService(prisma as never, issuers, profileService, registry);
  const configurations = new FiscalConfigurationService(prisma as never, issuers, readiness, registry, accessAudit);
  const emissions = new FiscalEmissionService(
    prisma as never,
    configurations,
    issuers,
    new FiscalProfileResolver(prisma as never),
    registry,
    new FiscalSaleLoader(prisma as never),
    audit,
    jobs as never
  );
  const processor = new FiscalEmissionProcessor(prisma as never, registry, contexts, states, cancellations, audit);
  const sync = new FiscalSyncService(prisma as never, registry, contexts, states, cancellations, audit, jobs as never);
  const trigger = new FiscalTriggerService(prisma as never, emissions, audit);
  const documents = new FiscalDocumentsService(prisma as never, registry, contexts, documentStorage);
  const guard = new FiscalOrderGuardService(prisma as never);

  const handlers: Record<string, { execute(job: QueuedJob): Promise<unknown> }> = {
    FISCAL_EMISSION: processor,
    FISCAL_SYNC: sync,
    FISCAL_CANCELLATION: cancellations as never,
  };

  /** Runs queued jobs like the worker: retries thrown errors until maxAttempts. */
  async function runJobs(limit = 50) {
    for (let round = 0; round < limit; round++) {
      const job = queue.find((candidate) => !candidate.done);
      if (!job) return;
      job.attempts += 1;
      try {
        await handlers[job.type].execute(job);
        job.done = true;
      } catch {
        if (job.attempts >= job.maxAttempts) job.done = true;
      }
    }
  }

  let orderSeq = 0;
  function seedOrder(overrides: Record<string, unknown> = {}, options: { paid?: boolean; complement?: boolean; items?: Array<Record<string, unknown>> } = {}) {
    const id = randomUUID();
    const total = new Prisma.Decimal((overrides.total as string) ?? "28.00");
    prisma.table("order").push({
      id,
      tenantId: TENANT,
      status: "PENDING",
      source: "COUNTER",
      publicCode: `B${++orderSeq}`,
      serviceTabId: null,
      total,
      paymentMethod: "PIX",
      consumerDocument: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
      ...(overrides.total ? { total } : {}),
    });
    const items = options.items ?? [
      {
        productId: HOT_DOG,
        productNameSnapshot: "Hot Dog",
        quantity: 1,
        unitPrice: total,
        total,
        baseUnitPrice: options.complement === false ? total : total.sub(3),
        calculatedUnitPrice: total,
        chargedUnitPrice: total,
        modifications:
          options.complement === false
            ? []
            : [{ type: "ADD_COMPLEMENT", complementId: BACON, nameSnapshot: "Bacon extra", quantity: new Prisma.Decimal(1), unitPriceDelta: new Prisma.Decimal(3), totalPriceDelta: new Prisma.Decimal(3) }],
      },
    ];
    for (const item of items) {
      const itemId = randomUUID();
      const { modifications = [], ...rest } = item as { modifications?: Array<Record<string, unknown>> };
      prisma.table("orderItem").push({ id: itemId, tenantId: TENANT, orderId: id, ...rest } as never);
      for (const modification of modifications) prisma.table("orderItemModification").push({ id: randomUUID(), tenantId: TENANT, orderItemId: itemId, ...modification } as never);
    }
    if (options.paid !== false && !overrides.serviceTabId) pay({ orderId: id }, "PIX", total);
    return id;
  }

  function pay(target: { orderId?: string; serviceTabId?: string }, method: string, amount: Prisma.Decimal.Value) {
    const paymentId = randomUUID();
    prisma.table("payment").push({ id: paymentId, tenantId: TENANT, method, cancelledAt: null, refundedAt: null } as never);
    prisma.table("paymentAllocation").push({ id: randomUUID(), tenantId: TENANT, paymentId, orderId: target.orderId ?? null, serviceTabId: target.serviceTabId ?? null, amount: new Prisma.Decimal(amount) } as never);
  }

  const documentsOf = () => prisma.table("fiscalDocument");
  const events = (documentId: string) => prisma.table("fiscalDocumentEvent").filter((event) => event.documentId === documentId).map((event) => event.type);

  return {
    prisma, secrets, fake, registry, files, queue, logs, jobs,
    emissions, processor, sync, trigger, cancellations, documents, guard, configurations,
    runJobs, seedOrder, pay, documentsOf, events,
  };
}
