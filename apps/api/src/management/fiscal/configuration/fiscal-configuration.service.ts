import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { AccessAuditEventType, AccessAuditResult, FiscalConfiguration, OrderSource } from "@prisma/client";
import type { FiscalCertificateView, FiscalConfigurationView, FiscalConnectionView, FiscalEligibleSource } from "../fiscal.types";
import { AuthUser } from "../../../platform/auth/auth.types";
import { PrismaService } from "../../../platform/database/prisma.service";
import { AccessAuditService } from "../../access/access-audit.service";
import { FiscalProviderRegistry } from "../providers/fiscal-provider.registry";
import { UpdateFiscalConfigurationDto } from "./dto/fiscal-configuration.dto";
import { FiscalIssuerService, missingAddressFields } from "./fiscal-issuer.service";
import { FiscalReadinessService } from "./fiscal-readiness.service";

export const ELIGIBLE_SOURCES: OrderSource[] = [OrderSource.COUNTER, OrderSource.IMPORT, OrderSource.API];
const DEFAULT_CANCEL_REASON = "Venda cancelada a pedido do cliente";
const DAY_MS = 86_400_000;

@Injectable()
export class FiscalConfigurationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FiscalIssuerService) private readonly issuers: FiscalIssuerService,
    @Inject(FiscalReadinessService) private readonly readiness: FiscalReadinessService,
    @Inject(FiscalProviderRegistry) private readonly registry: FiscalProviderRegistry,
    @Inject(AccessAuditService) private readonly audit: AccessAuditService
  ) {}

  /** Stored configuration or the defaults (disabled, manual, homologation). */
  async current(tenantId: string): Promise<FiscalConfiguration> {
    const stored = await this.prisma.fiscalConfiguration.findUnique({ where: { tenantId } });
    if (stored) return stored;
    const now = new Date();
    return {
      id: "",
      tenantId,
      enabled: false,
      provider: null,
      environment: "HOMOLOGATION",
      series: null,
      emissionMode: "MANUAL",
      eligibleSources: ELIGIBLE_SOURCES,
      defaultCancelReason: DEFAULT_CANCEL_REASON,
      enabledAt: null,
      updatedByUserId: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  async get(tenantId: string): Promise<FiscalConfigurationView> {
    const stored = await this.current(tenantId);
    // Before the provider is saved, show the only available provider so a connection made from
    // the screen is reflected immediately.
    const configuration = { ...stored, provider: stored.provider ?? this.registry.defaultProvider() };
    const [issuer, address, readiness, connection, certificate] = await Promise.all([
      this.issuers.get(tenantId),
      this.issuers.address(tenantId),
      this.readiness.evaluate(tenantId, configuration.provider),
      configuration.provider
        ? this.prisma.fiscalProviderConnection.findUnique({
            where: { tenantId_provider: { tenantId, provider: configuration.provider } },
          })
        : Promise.resolve(null),
      this.prisma.fiscalCertificate.findFirst({ where: { tenantId, status: "ACTIVE" } }),
    ]);
    const adapter =
      configuration.provider && this.registry.has(configuration.provider) ? this.registry.get(configuration.provider) : null;
    const connectionView: FiscalConnectionView | null = configuration.provider
      ? {
          provider: configuration.provider,
          status: connection?.status ?? "DRAFT",
          connectedAt: connection?.connectedAt?.toISOString() ?? null,
          lastErrorMessage: connection?.lastErrorMessage ?? null,
          capabilities: {
            cancelViaApi: adapter?.capabilities.cancelViaApi ?? false,
            usesOwnCertificate: adapter?.capabilities.usesOwnCertificate ?? false,
            itemTaxesFromProvider: adapter?.capabilities.itemTaxesFromProvider ?? false,
          },
        }
      : null;
    const certificateView: FiscalCertificateView | null = certificate
      ? {
          subjectName: certificate.subjectName,
          cnpj: certificate.cnpj,
          validFrom: certificate.validFrom.toISOString(),
          validTo: certificate.validTo.toISOString(),
          daysToExpire: Math.floor((certificate.validTo.getTime() - Date.now()) / DAY_MS),
          cnpjMatchesIssuer: certificate.cnpj && issuer ? certificate.cnpj === issuer.cnpj : null,
        }
      : null;
    return {
      enabled: configuration.enabled,
      provider: configuration.provider,
      environment: configuration.environment,
      series: configuration.series,
      emissionMode: configuration.emissionMode,
      eligibleSources: configuration.eligibleSources.filter((source): source is FiscalEligibleSource =>
        ELIGIBLE_SOURCES.includes(source)
      ),
      defaultCancelReason: configuration.defaultCancelReason,
      issuer,
      address,
      missingAddressFields: missingAddressFields(address),
      connection: connectionView,
      certificate: certificateView,
      readiness,
      updatedAt: configuration.id ? configuration.updatedAt.toISOString() : null,
    };
  }

  async update(user: AuthUser, dto: UpdateFiscalConfigurationDto): Promise<FiscalConfigurationView> {
    const before = await this.current(user.tenantId);
    if (before.provider && before.provider !== dto.provider) {
      const pending = await this.prisma.fiscalDocument.count({
        where: { tenantId: user.tenantId, status: { in: ["PENDING", "PROCESSING", "CANCEL_PENDING"] } },
      });
      if (pending > 0) {
        throw new ConflictException({
          code: "PENDING_DOCUMENTS",
          message: `Existem ${pending} nota(s) em processamento ou cancelamento; conclua-as antes de trocar de provedor`,
        });
      }
    }
    if (dto.enabled) {
      const readiness = await this.readiness.evaluate(user.tenantId, dto.provider);
      if (!readiness.ready) {
        throw new ConflictException({
          code: "NOT_READY",
          message: "Configuracao fiscal incompleta",
          items: readiness.items.filter((item) => item.blocking && !item.ok),
        });
      }
    }
    const data = {
      enabled: dto.enabled,
      provider: dto.provider,
      environment: dto.environment,
      series: dto.series,
      emissionMode: dto.emissionMode,
      defaultCancelReason: dto.defaultCancelReason,
      enabledAt: dto.enabled && !before.enabled ? new Date() : before.enabledAt,
      updatedByUserId: user.id,
    };
    await this.prisma.fiscalConfiguration.upsert({
      where: { tenantId: user.tenantId },
      create: { tenantId: user.tenantId, eligibleSources: ELIGIBLE_SOURCES, ...data },
      update: data,
    });
    await this.audit.record({
      actorUserId: user.id,
      storeId: user.tenantId,
      eventType: AccessAuditEventType.FISCAL_CONFIGURATION_CHANGED,
      result: AccessAuditResult.SUCCESS,
      metadata: {
        section: "configuration",
        before: {
          enabled: before.enabled,
          provider: before.provider,
          environment: before.environment,
          emissionMode: before.emissionMode,
          series: before.series,
        },
        after: {
          enabled: dto.enabled,
          provider: dto.provider,
          environment: dto.environment,
          emissionMode: dto.emissionMode,
          series: dto.series,
        },
      },
    });
    return this.get(user.tenantId);
  }
}
