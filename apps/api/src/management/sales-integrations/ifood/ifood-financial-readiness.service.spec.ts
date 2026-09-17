import { NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { SalesProviderError } from "../sales-provider.adapter";
import { IfoodFinancialReadinessService } from "./ifood-financial-readiness.service";

function integrationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sales-1",
    tenantId: "tenant-1",
    provider: "IFOOD",
    environment: "PRODUCTION",
    externalMerchantId: "merchant-1",
    deliveryIntegrationId: "delivery-1",
    financialReadiness: null,
    lastValidationAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    createdAt: new Date(Date.now() - 60 * 60 * 1000),
    ...overrides,
  };
}

function setup(options: {
  integration?: Record<string, unknown>;
  credentialResult?: unknown;
  fetchSalesResult?: unknown;
  counts?: { sales?: number; events?: number; settlements?: number; files?: number };
} = {}) {
  const integration = integrationRow(options.integration);
  const prisma = {
    salesIntegration: {
      findFirst: vi.fn().mockResolvedValue(integration),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...integration, ...data })),
    },
    externalFinancialSale: { count: vi.fn().mockResolvedValue(options.counts?.sales ?? 0) },
    externalFinancialEvent: { count: vi.fn().mockResolvedValue(options.counts?.events ?? 0) },
    externalSettlement: { count: vi.fn().mockResolvedValue(options.counts?.settlements ?? 0) },
    externalReconciliationFile: { count: vi.fn().mockResolvedValue(options.counts?.files ?? 0) },
  };
  const credentials = {
    getCredential:
      options.credentialResult instanceof Error
        ? vi.fn().mockRejectedValue(options.credentialResult)
        : vi
            .fn()
            .mockResolvedValue(
              options.credentialResult ?? {
                accessToken: "token",
                merchantId: "merchant-1",
                environment: "PRODUCTION",
                expiresAt: null,
              }
            ),
  };
  const client = {
    fetchSales:
      options.fetchSalesResult instanceof Error
        ? vi.fn().mockRejectedValue(options.fetchSalesResult)
        : vi.fn().mockResolvedValue(options.fetchSalesResult ?? { sales: [], pagesFetched: 1, totalPages: 1, totalElements: 0 }),
  };
  const audit = { record: vi.fn() };
  return {
    service: new IfoodFinancialReadinessService(
      prisma as never,
      credentials as never,
      client as never,
      audit as never
    ),
    prisma,
    credentials,
    client,
    audit,
    integration,
  };
}

describe("IfoodFinancialReadinessService", () => {
  it("throws when the integration does not exist for the tenant", async () => {
    const { service, prisma } = setup();
    prisma.salesIntegration.findFirst.mockResolvedValue(null);
    await expect(service.get("tenant-1", "missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("marks a healthy production connection ready only once evidence exists", async () => {
    const { service } = setup({
      counts: { sales: 1, events: 1, settlements: 1, files: 1 },
    });
    const result = await service.revalidate("tenant-1", "sales-1", "user-1");
    expect(result.status).toBe("READY_PRODUCTION");
    expect(result.productionEnabled).toBe(true);
    expect(result.checks.every((check) => check.passed)).toBe(true);
  });

  it("keeps production disabled while homologation evidence is incomplete", async () => {
    const { service } = setup({ counts: { sales: 1, events: 0, settlements: 0, files: 0 } });
    const result = await service.revalidate("tenant-1", "sales-1", "user-1");
    expect(result.status).toBe("READY_PRODUCTION");
    expect(result.productionEnabled).toBe(false);
    expect(result.checks.find((check) => check.code === "FINANCIAL_EVENTS_EVIDENCE")?.passed).toBe(
      false
    );
  });

  it("reports pending permission for a forbidden merchant within the propagation window", async () => {
    const { service } = setup({
      integration: { createdAt: new Date() },
      fetchSalesResult: new SalesProviderError(
        "AUTHENTICATION",
        "Credencial sem permissao para o merchant financeiro iFood",
        false
      ),
    });
    const result = await service.revalidate("tenant-1", "sales-1");
    expect(result.status).toBe("PENDING_PERMISSION");
  });

  it("reports attention when forbidden persists past the propagation window", async () => {
    const { service } = setup({
      integration: { createdAt: new Date(Date.now() - 60 * 60 * 1000) },
      fetchSalesResult: new SalesProviderError(
        "AUTHENTICATION",
        "Credencial sem permissao para o merchant financeiro iFood",
        false
      ),
    });
    const result = await service.revalidate("tenant-1", "sales-1");
    expect(result.status).toBe("REQUIRES_ATTENTION");
  });

  it("reports attention for an expired credential", async () => {
    const { service } = setup({
      fetchSalesResult: new SalesProviderError(
        "AUTHENTICATION",
        "Credencial financeira iFood expirada ou invalida",
        false
      ),
    });
    const result = await service.revalidate("tenant-1", "sales-1");
    expect(result.status).toBe("REQUIRES_ATTENTION");
  });

  it("reports attention for a merchant mismatch without destroying the connection", async () => {
    const { service, prisma } = setup({
      integration: { createdAt: new Date(Date.now() - 60 * 60 * 1000) },
      credentialResult: new UnprocessableEntityException("Merchant ou ambiente iFood divergente"),
    });
    const result = await service.revalidate("tenant-1", "sales-1");
    expect(result.status).toBe("REQUIRES_ATTENTION");
    expect(prisma.salesIntegration.update).toHaveBeenCalled();
  });

  it("keeps the previous status on a transient rate limit failure", async () => {
    const { service } = setup({
      integration: { financialReadiness: "READY_TEST" },
      fetchSalesResult: new SalesProviderError(
        "RATE_LIMIT",
        "API Financeira iFood temporariamente indisponivel",
        true
      ),
    });
    const result = await service.revalidate("tenant-1", "sales-1");
    expect(result.status).toBe("READY_TEST");
  });

  it("emits a production gate audit event only on the transition into readiness", async () => {
    const { service, audit } = setup({ counts: { sales: 1, events: 1, settlements: 1, files: 1 } });
    await service.revalidate("tenant-1", "sales-1", "user-1");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "IFOOD_FINANCIAL_PRODUCTION_GATE_OPENED" })
    );
  });
});
