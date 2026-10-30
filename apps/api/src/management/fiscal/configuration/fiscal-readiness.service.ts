import { Inject, Injectable } from "@nestjs/common";
import type { FiscalProvider } from "@prisma/client";
import type { FiscalReadiness, FiscalReadinessItem } from "../fiscal.types";
import { PrismaService } from "../../../platform/database/prisma.service";
import { FiscalProviderRegistry } from "../providers/fiscal-provider.registry";
import { FiscalProfileService } from "../profiles/fiscal-profile.service";
import { FiscalIssuerService, missingAddressFields } from "./fiscal-issuer.service";

const ADDRESS_LABELS: Record<string, string> = {
  street: "logradouro",
  number: "numero",
  neighborhood: "bairro",
  city: "cidade",
  state: "UF",
  postalCode: "CEP",
};

/** Checklist shown on the configuration screen; blocking items prevent enabling emission. */
@Injectable()
export class FiscalReadinessService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FiscalIssuerService) private readonly issuers: FiscalIssuerService,
    @Inject(FiscalProfileService) private readonly profiles: FiscalProfileService,
    @Inject(FiscalProviderRegistry) private readonly registry: FiscalProviderRegistry
  ) {}

  async evaluate(tenantId: string, provider: FiscalProvider | null): Promise<FiscalReadiness> {
    const [issuer, address, defaultProfile, missing, certificate, connection] = await Promise.all([
      this.issuers.get(tenantId),
      this.issuers.address(tenantId),
      this.profiles.hasDefaultProfile(tenantId),
      this.profiles.missing(tenantId),
      this.prisma.fiscalCertificate.findFirst({ where: { tenantId, status: "ACTIVE" } }),
      provider
        ? this.prisma.fiscalProviderConnection.findUnique({ where: { tenantId_provider: { tenantId, provider } } })
        : Promise.resolve(null),
    ]);
    const items: FiscalReadinessItem[] = [];
    const add = (key: FiscalReadinessItem["key"], ok: boolean, message: string, blocking = true) =>
      items.push({ key, ok, blocking, message });

    add("ISSUER", Boolean(issuer), issuer ? "Dados do emitente informados" : "Informe razao social, CNPJ e inscricao estadual");
    const missingFields = missingAddressFields(address);
    add(
      "ADDRESS",
      missingFields.length === 0 && Boolean(issuer?.municipalityIbgeCode),
      missingFields.length
        ? `Complete o endereco da loja: ${missingFields.map((field) => ADDRESS_LABELS[field] ?? field).join(", ")}`
        : issuer?.municipalityIbgeCode
          ? "Endereco completo"
          : "Codigo IBGE do municipio nao informado"
    );

    const adapter = provider && this.registry.has(provider) ? this.registry.get(provider) : null;
    if (!provider) add("CONNECTION", false, "Escolha o provedor de emissao");
    else if (!adapter) add("CONNECTION", false, `Provedor ${provider} indisponivel nesta versao`);
    else add("CONNECTION", connection?.status === "CONNECTED", connection?.status === "CONNECTED" ? "Provedor conectado" : "Conecte a conta do provedor");

    if (adapter) {
      const issues = adapter.validateSettings((connection?.settings as Record<string, unknown>) ?? {});
      for (const key of ["OPERATION_NATURE", "PAYMENT_MAP"] as const) {
        const issue = issues.find((item) => item.key === key);
        if (issue) add(key, false, issue.message);
      }
    }

    const certificateValid = Boolean(certificate && certificate.validTo.getTime() > Date.now());
    const certificateRequired = Boolean(adapter?.capabilities.usesOwnCertificate);
    const cnpjMismatch = Boolean(certificate?.cnpj && issuer && certificate.cnpj !== issuer.cnpj);
    add(
      "CERTIFICATE",
      certificateValid && !cnpjMismatch,
      !certificate
        ? certificateRequired
          ? "Envie o certificado A1"
          : "Certificado A1 nao enviado (o provedor usa o certificado da propria conta)"
        : !certificateValid
          ? "Certificado A1 vencido"
          : cnpjMismatch
            ? "CNPJ do certificado diferente do CNPJ do emitente"
            : "Certificado A1 valido",
      certificateRequired
    );

    add("DEFAULT_PROFILE", defaultProfile, defaultProfile ? "Perfil fiscal padrao atribuido" : "Atribua um perfil fiscal a pelo menos uma categoria");
    const missingCount = missing.products.length + missing.complements.length;
    add(
      "PRODUCTS_WITHOUT_PROFILE",
      missingCount === 0,
      missingCount === 0 ? "Todos os produtos tem perfil fiscal" : `${missingCount} produto(s)/complemento(s) sem perfil fiscal`,
      false
    );

    return { ready: items.every((item) => item.ok || !item.blocking), items };
  }
}
