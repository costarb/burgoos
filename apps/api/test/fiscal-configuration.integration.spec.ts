import { ConflictException, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { AccessAuditService } from "../src/management/access/access-audit.service";
import { FiscalConfigurationService } from "../src/management/fiscal/configuration/fiscal-configuration.service";
import { FiscalIssuerService } from "../src/management/fiscal/configuration/fiscal-issuer.service";
import { FiscalReadinessService } from "../src/management/fiscal/configuration/fiscal-readiness.service";
import { IbgeMunicipalityClient } from "../src/management/fiscal/configuration/ibge-municipality.client";
import { FiscalProfileService } from "../src/management/fiscal/profiles/fiscal-profile.service";
import { FiscalProviderRegistry } from "../src/management/fiscal/providers/fiscal-provider.registry";
import { FakeFiscalProviderAdapter } from "../src/management/fiscal/providers/testing/fake-fiscal-provider.adapter";
import type { AuthUser } from "../src/platform/auth/auth.types";
import { createFiscalFakePrisma } from "./support/fiscal-fake-prisma";

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";
const user = (tenantId: string): AuthUser => ({
  id: tenantId === TENANT_A ? "aaaaaaaa-0000-4000-8000-000000000001" : "bbbbbbbb-0000-4000-8000-000000000001",
  tenantId,
  role: UserRole.OWNER,
  email: "dono@loja.test",
  name: "Dono",
});
const SP_ADDRESS = {
  street: "Rua Augusta",
  number: "100",
  neighborhood: "Consolacao",
  city: "São Paulo",
  state: "sp",
  postalCode: "01305-000",
};
const PROFILE = { name: "Alimentacao preparada", ncm: "2106.90.90", cfop: "5102", csosn: "102", origin: 0, commercialUnit: "un" };
const ISSUER = { legalName: "Dogao LTDA", cnpj: "11.222.333/0001-81", stateRegistration: "110.042.490.114", taxRegime: "SIMPLES_NACIONAL" as const };

describe("fiscal configuration (US1/US2)", () => {
  let prisma: ReturnType<typeof createFiscalFakePrisma>;
  let issuers: FiscalIssuerService;
  let profiles: FiscalProfileService;
  let configuration: FiscalConfigurationService;
  let registry: FiscalProviderRegistry;
  let fake: FakeFiscalProviderAdapter;
  let ibgeCalls: string[];

  beforeEach(() => {
    prisma = createFiscalFakePrisma({
      tenant: [
        { id: TENANT_A, name: "Dogao", config: { address: SP_ADDRESS } },
        { id: TENANT_B, name: "Outra", config: {} },
      ],
      category: [
        { id: "c0000000-0000-4000-8000-00000000000a", tenantId: TENANT_A, name: "Lanches" },
        { id: "c0000000-0000-4000-8000-00000000000b", tenantId: TENANT_B, name: "Lanches B" },
      ],
      product: [
        { id: "p0000000-0000-4000-8000-00000000000a", tenantId: TENANT_A, categoryId: "c0000000-0000-4000-8000-00000000000a", name: "Hot Dog" },
        { id: "p0000000-0000-4000-8000-00000000000b", tenantId: TENANT_B, categoryId: "c0000000-0000-4000-8000-00000000000b", name: "Lanche B" },
      ],
    });
    const ibge = new IbgeMunicipalityClient();
    ibgeCalls = [];
    ibge.useFetcher(async (url) => {
      ibgeCalls.push(url);
      return { ok: true, json: async () => [{ id: 3550308, nome: "São Paulo" }, { id: 3509502, nome: "Campinas" }] };
    });
    const audit = new AccessAuditService(prisma as never);
    issuers = new FiscalIssuerService(prisma as never, ibge, audit);
    profiles = new FiscalProfileService(prisma as never, audit);
    registry = new FiscalProviderRegistry();
    fake = new FakeFiscalProviderAdapter();
    registry.register(fake);
    const readiness = new FiscalReadinessService(prisma as never, issuers, profiles, registry);
    configuration = new FiscalConfigurationService(prisma as never, issuers, readiness, registry, audit);
  });

  it("saves the issuer, reusing the store address and resolving the IBGE code", async () => {
    const issuer = await issuers.update(user(TENANT_A), ISSUER);

    expect(issuer).toMatchObject({ cnpj: "11222333000181", stateRegistration: "110042490114", municipalityIbgeCode: "3550308", municipalityIbgeSource: "IBGE_API" });
    expect(ibgeCalls[0]).toContain("/estados/SP/municipios");
    const snapshot = await issuers.snapshot(TENANT_A);
    expect(snapshot?.address).toMatchObject({ city: "São Paulo", state: "SP", postalCode: "01305000", municipalityIbgeCode: "3550308" });
    expect(snapshot?.tradeName).toBe("Dogao");
    expect(prisma.table("accessAuditEvent")[0]).toMatchObject({ eventType: "FISCAL_CONFIGURATION_CHANGED", storeId: TENANT_A });
  });

  it("rejects invalid CNPJ, invalid SP state registration and stores without UF", async () => {
    await expect(issuers.update(user(TENANT_A), { ...ISSUER, cnpj: "11222333000182" })).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(issuers.update(user(TENANT_A), { ...ISSUER, stateRegistration: "110042491114" })).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(issuers.update(user(TENANT_B), ISSUER)).rejects.toMatchObject({ response: { code: "ADDRESS_INCOMPLETE" } });
  });

  it("asks for a manual IBGE code when the city is not found", async () => {
    prisma.table("tenant")[0].config = { address: { ...SP_ADDRESS, city: "Cidade Inexistente" } };
    await expect(issuers.update(user(TENANT_A), ISSUER)).rejects.toMatchObject({ response: { code: "IBGE_NOT_RESOLVED" } });
    const manual = await issuers.update(user(TENANT_A), { ...ISSUER, municipalityIbgeCode: "3550308" });
    expect(manual.municipalityIbgeSource).toBe("MANUAL");
  });

  it("validates profiles, prevents duplicate names and deletion while in use", async () => {
    await expect(profiles.create(user(TENANT_A), { ...PROFILE, csosn: "500" })).rejects.toMatchObject({
      response: { errors: expect.arrayContaining(["CEST e obrigatorio para o CSOSN 500"]) },
    });
    await expect(profiles.create(user(TENANT_A), { ...PROFILE, cfop: "6102" })).rejects.toBeInstanceOf(UnprocessableEntityException);

    const profile = await profiles.create(user(TENANT_A), PROFILE);
    expect(profile).toMatchObject({ ncm: "21069090", commercialUnit: "UN" });
    await expect(profiles.create(user(TENANT_A), PROFILE)).rejects.toBeInstanceOf(ConflictException);

    await profiles.assign(user(TENANT_A), { categories: [{ id: "c0000000-0000-4000-8000-00000000000a", fiscalProfileId: profile.id }] });
    expect((await profiles.list(TENANT_A))[0].usage).toEqual({ categories: 1, products: 0, complements: 0 });
    await expect(profiles.remove(user(TENANT_A), profile.id)).rejects.toMatchObject({ response: { code: "PROFILE_IN_USE" } });
  });

  it("lists products without a resolved profile until the category gets one", async () => {
    expect((await profiles.missing(TENANT_A)).products.map((item) => item.name)).toEqual(["Hot Dog"]);
    const profile = await profiles.create(user(TENANT_A), PROFILE);
    await profiles.assign(user(TENANT_A), { categories: [{ id: "c0000000-0000-4000-8000-00000000000a", fiscalProfileId: profile.id }] });
    expect((await profiles.missing(TENANT_A)).products).toEqual([]);
  });

  it("keeps tenants isolated for profiles and assignments", async () => {
    const profile = await profiles.create(user(TENANT_A), PROFILE);
    await expect(profiles.update(user(TENANT_B), profile.id, PROFILE)).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      profiles.assign(user(TENANT_B), { products: [{ id: "p0000000-0000-4000-8000-00000000000b", fiscalProfileId: profile.id }] })
    ).rejects.toMatchObject({ response: { code: "INVALID_PROFILE" } });
    const result = await profiles.assign(user(TENANT_A), {
      products: [{ id: "p0000000-0000-4000-8000-00000000000b", fiscalProfileId: profile.id }],
    });
    expect(result.updated).toBe(0);
    expect(await profiles.list(TENANT_B)).toEqual([]);
  });

  it("blocks enabling until readiness is complete, then enables and audits", async () => {
    const payload = { enabled: true, provider: "BLING" as const, environment: "HOMOLOGATION" as const, series: 1, emissionMode: "AUTOMATIC" as const, defaultCancelReason: "Venda cancelada a pedido do cliente" };
    await expect(configuration.update(user(TENANT_A), payload)).rejects.toMatchObject({ response: { code: "NOT_READY" } });

    await issuers.update(user(TENANT_A), ISSUER);
    const profile = await profiles.create(user(TENANT_A), PROFILE);
    await profiles.assign(user(TENANT_A), { categories: [{ id: "c0000000-0000-4000-8000-00000000000a", fiscalProfileId: profile.id }] });
    fake.settingsIssues = [{ key: "PAYMENT_MAP", message: "Mapeie PIX" }];
    prisma.table("fiscalProviderConnection").push({ id: "conn-a", tenantId: TENANT_A, provider: "BLING", status: "CONNECTED", settings: {} });

    const blocked = await configuration.update(user(TENANT_A), { ...payload, enabled: false });
    expect(blocked.readiness.items.find((item) => item.key === "PAYMENT_MAP")).toMatchObject({ ok: false, blocking: true });
    expect(blocked.readiness.items.find((item) => item.key === "CERTIFICATE")).toMatchObject({ ok: true, blocking: false, message: "O provedor usa o certificado A1 cadastrado na propria conta" });

    fake.settingsIssues = [];
    const view = await configuration.update(user(TENANT_A), payload);
    expect(view).toMatchObject({ enabled: true, provider: "BLING", emissionMode: "AUTOMATIC", readiness: { ready: true } });
    expect(view.connection).toMatchObject({ status: "CONNECTED", capabilities: { cancelViaApi: false } });
    expect(prisma.table("fiscalConfiguration")[0].enabledAt).toBeInstanceOf(Date);
  });

  it("blocks switching provider while documents are still pending", async () => {
    const payload = { enabled: false, provider: "BLING" as const, environment: "HOMOLOGATION" as const, series: 1, emissionMode: "MANUAL" as const, defaultCancelReason: "Venda cancelada a pedido do cliente" };
    await configuration.update(user(TENANT_A), payload);
    prisma.table("fiscalDocument").push({ id: "doc-1", tenantId: TENANT_A, status: "CANCEL_PENDING" });

    await expect(configuration.update(user(TENANT_A), { ...payload, provider: null })).rejects.toMatchObject({
      response: { code: "PENDING_DOCUMENTS" },
    });
  });

  it("returns defaults for a tenant never configured", async () => {
    const view = await configuration.get(TENANT_B);
    expect(view).toMatchObject({ enabled: false, provider: null, emissionMode: "MANUAL", environment: "HOMOLOGATION", eligibleSources: ["COUNTER", "IMPORT", "API"], updatedAt: null });
    expect(view.missingAddressFields).toEqual(["street", "number", "neighborhood", "city", "state", "postalCode"]);
  });
});
