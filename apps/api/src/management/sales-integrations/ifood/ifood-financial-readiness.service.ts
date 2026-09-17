import {
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
  UnprocessableEntityException,
} from "@nestjs/common";
import { Prisma, SalesIntegration } from "@prisma/client";
import { PrismaService } from "../../../platform/database/prisma.service";
import { IntegrationAuditService } from "../integration-audit.service";
import { SalesProviderError } from "../sales-provider.adapter";
import { IfoodFinancialClient } from "./ifood-financial.client";
import { IfoodFinancialCredentialService } from "./ifood-financial-credential.service";

export type IfoodFinancialReadinessStatus =
  | "PENDING_PERMISSION"
  | "READY_TEST"
  | "READY_PRODUCTION"
  | "REQUIRES_ATTENTION";

export interface IfoodFinancialReadinessCheck {
  code: string;
  passed: boolean;
  message: string | null;
}

export interface IfoodFinancialReadinessView {
  integrationId: string;
  status: IfoodFinancialReadinessStatus;
  environment: "TEST" | "PRODUCTION";
  merchantId: string;
  permissions: string[];
  productionEnabled: boolean;
  lastValidatedAt: string | null;
  checks: IfoodFinancialReadinessCheck[];
}

interface AccessResult {
  status: IfoodFinancialReadinessStatus;
  errorCode: string | null;
  errorMessage: string | null;
}

/** Newly granted iFood scopes can take up to 10 minutes to propagate. */
const PROPAGATION_WINDOW_MS = 10 * 60 * 1000;

@Injectable()
export class IfoodFinancialReadinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: IfoodFinancialCredentialService,
    private readonly client: IfoodFinancialClient,
    @Optional() private readonly audit?: IntegrationAuditService
  ) {}

  async get(tenantId: string, integrationId: string): Promise<IfoodFinancialReadinessView> {
    const integration = await this.load(tenantId, integrationId);
    return this.buildView(integration);
  }

  async revalidate(
    tenantId: string,
    integrationId: string,
    actorUserId?: string | null
  ): Promise<IfoodFinancialReadinessView> {
    const integration = await this.load(tenantId, integrationId);
    const previousStatus = integration.financialReadiness;
    const access = await this.checkAccess(integration);
    const checks = await this.evidenceChecks(integration);
    const productionEnabled =
      access.status === "READY_PRODUCTION" && checks.every((check) => check.passed);
    const updated = await this.prisma.salesIntegration.update({
      where: { id: integration.id },
      data: {
        financialReadiness: access.status,
        lastValidationAt: new Date(),
        lastErrorCode: access.errorCode,
        lastErrorMessage: access.errorMessage,
        homologationEvidence: {
          checks,
          productionEnabled,
          computedAt: new Date().toISOString(),
        } as unknown as Prisma.InputJsonValue,
      },
    });
    if (this.audit) {
      await this.audit.record({
        tenantId,
        integrationId,
        actorUserId,
        action: "IFOOD_FINANCIAL_READINESS_VALIDATED",
        outcome: access.status,
        metadata: { outcomeCode: access.errorCode ?? access.status },
      });
      if (productionEnabled && previousStatus !== "READY_PRODUCTION") {
        await this.audit.record({
          tenantId,
          integrationId,
          actorUserId,
          action: "IFOOD_FINANCIAL_PRODUCTION_GATE_OPENED",
          outcome: "READY_PRODUCTION",
        });
      }
    }
    return this.buildView(updated, checks);
  }

  private async load(tenantId: string, integrationId: string): Promise<SalesIntegration> {
    const integration = await this.prisma.salesIntegration.findFirst({
      where: { id: integrationId, tenantId, provider: "IFOOD" },
    });
    if (!integration) throw new NotFoundException("Integracao financeira iFood nao encontrada");
    return integration;
  }

  private async checkAccess(integration: SalesIntegration): Promise<AccessResult> {
    try {
      const credential = await this.credentials.getCredential(integration.tenantId, integration.id);
      const today = new Date().toISOString().slice(0, 10);
      await this.client.fetchSales({
        accessToken: credential.accessToken,
        merchantId: credential.merchantId,
        startDate: today,
        endDate: today,
      });
      const status: IfoodFinancialReadinessStatus =
        integration.environment === "PRODUCTION" ? "READY_PRODUCTION" : "READY_TEST";
      return { status, errorCode: null, errorMessage: null };
    } catch (error) {
      return this.classifyFailure(integration, error);
    }
  }

  private classifyFailure(integration: SalesIntegration, error: unknown): AccessResult {
    const withinPropagationWindow =
      Date.now() - integration.createdAt.getTime() < PROPAGATION_WINDOW_MS;
    if (error instanceof SalesProviderError) {
      if (error.code === "AUTHENTICATION") {
        const forbidden = /permissao/i.test(error.message);
        return {
          status: forbidden && withinPropagationWindow ? "PENDING_PERMISSION" : "REQUIRES_ATTENTION",
          errorCode: error.code,
          errorMessage: error.message,
        };
      }
      // Transient failures (RATE_LIMIT, UNAVAILABLE, TIMEOUT, INCOMPATIBLE_RESPONSE) must not
      // destroy an otherwise healthy connection; keep the previous status.
      return {
        status: integration.financialReadiness ?? "PENDING_PERMISSION",
        errorCode: error.code,
        errorMessage: error.message,
      };
    }
    if (
      error instanceof NotFoundException ||
      error instanceof UnprocessableEntityException ||
      error instanceof ConflictException
    ) {
      const message = error.message;
      return {
        status: withinPropagationWindow ? "PENDING_PERMISSION" : "REQUIRES_ATTENTION",
        errorCode: "LINK_INVALID",
        errorMessage: message,
      };
    }
    return {
      status: "REQUIRES_ATTENTION",
      errorCode: "UNKNOWN",
      errorMessage: error instanceof Error ? error.message : "Falha desconhecida ao validar acesso",
    };
  }

  private async evidenceChecks(integration: SalesIntegration): Promise<IfoodFinancialReadinessCheck[]> {
    const where = { tenantId: integration.tenantId, integrationId: integration.id };
    const [sales, events, settlements, files] = await Promise.all([
      this.prisma.externalFinancialSale.count({ where }),
      this.prisma.externalFinancialEvent.count({ where }),
      this.prisma.externalSettlement.count({ where }),
      this.prisma.externalReconciliationFile.count({ where: { ...where, status: "READY" } }),
    ]);
    return [
      {
        code: "SALES_EVIDENCE",
        passed: sales > 0,
        message: sales > 0 ? null : "Nenhuma venda financeira iFood sincronizada",
      },
      {
        code: "FINANCIAL_EVENTS_EVIDENCE",
        passed: events > 0,
        message: events > 0 ? null : "Nenhum evento financeiro reconciliado",
      },
      {
        code: "SETTLEMENTS_EVIDENCE",
        passed: settlements > 0,
        message: settlements > 0 ? null : "Nenhum repasse reconciliado",
      },
      {
        code: "RECONCILIATION_FILE_EVIDENCE",
        passed: files > 0,
        message: files > 0 ? null : "Nenhum arquivo de conciliacao sob demanda gerado",
      },
    ];
  }

  private async buildView(
    integration: SalesIntegration,
    precomputedChecks?: IfoodFinancialReadinessCheck[]
  ): Promise<IfoodFinancialReadinessView> {
    const evidence = precomputedChecks ?? (await this.evidenceChecks(integration));
    const linkCheck: IfoodFinancialReadinessCheck = {
      code: "MERCHANT_LINK",
      passed: Boolean(integration.deliveryIntegrationId),
      message: integration.deliveryIntegrationId ? null : "Vincule a conexao operacional iFood",
    };
    const status: IfoodFinancialReadinessStatus =
      (integration.financialReadiness as IfoodFinancialReadinessStatus | null) ??
      "PENDING_PERMISSION";
    const permissionCheck: IfoodFinancialReadinessCheck = {
      code: "FINANCIAL_PERMISSION",
      passed: status === "READY_TEST" || status === "READY_PRODUCTION",
      message: status === "READY_TEST" || status === "READY_PRODUCTION" ? null : integration.lastErrorMessage,
    };
    const checks = [linkCheck, permissionCheck, ...evidence];
    const productionEnabled = status === "READY_PRODUCTION" && evidence.every((check) => check.passed);
    return {
      integrationId: integration.id,
      status,
      environment: integration.environment as "TEST" | "PRODUCTION",
      merchantId: integration.externalMerchantId ?? "",
      permissions: [],
      productionEnabled,
      lastValidatedAt: integration.lastValidationAt ? integration.lastValidationAt.toISOString() : null,
      checks,
    };
  }
}
