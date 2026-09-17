import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = path.join(root, "packages", "database", "prisma", "schema.prisma");
const outputPath = path.join(root, "docs", "DATA_DICTIONARY.md");
const schema = await readFile(schemaPath, "utf8");

const domains = [
  ["Tenancy, identidade e acesso", ["Tenant", "PlatformUser", "User", "UserStoreAssignment", "AccessProfile", "Permission", "AccessProfilePermission", "SessionToken", "PasswordResetToken", "AccessAuditEvent"]],
  ["Configuração visual e catálogo", ["LayoutPreset", "StoreVisualConfiguration", "Category", "Product", "ProductExternalMapping", "ProductComplement", "ProductComplementAssignment", "Ingredient", "TechnicalSheet", "TechnicalSheetLine", "ProductCostSnapshot"]],
  ["Pedidos, comandas e operação", ["Order", "OrderItem", "OrderItemModification", "ServiceTab", "OrderMaintenance", "OrderOperationalEvent", "OrderProfitabilitySnapshot", "StockMovement"]],
  ["Pagamentos", ["PaymentTerminal", "PaymentCharge", "Payment", "PaymentAllocation", "PaymentProviderEvent", "PaymentException", "IdempotencyRecord"]],
  ["Integrações de vendas", ["SalesIntegration", "SalesIntegrationCredential", "SalesImportRun", "SalesImportDay", "ExternalSalesMovement", "ExternalSaleIdentity", "OAuthAuthorizationAttempt", "ProviderTransactionState", "ProviderNotification", "IntegrationAuditEvent", "PlatformIntegrationConfiguration"]],
  ["Financeiro", ["FinancialConfiguration", "PurchaseUnit", "Supplier", "FinancialAccount", "PaymentInstitutionConfiguration", "FinancialCategory", "PayableRecurrence", "Payable", "PayablePayment", "CashMovement", "FinancialAudit"]],
  ["Delivery e marketplaces", ["OrderPlatform", "DeliveryIntegration", "DeliveryIntegrationCredential", "DeliveryPlatformEvent", "PlatformOrderLink", "PlatformSyncAttempt", "PlatformCancellationReason", "PlatformDispute", "DeliveryIntegrationAudit"]],
  ["Jobs, exportações e notificações", ["ExportJob", "BackgroundJob", "BackgroundJobAttempt", "OperationalNotification"]],
];

const purposes = {
  Tenant: "Estabelecimento/loja que delimita propriedade e isolamento dos dados.",
  PlatformUser: "Usuário administrativo global da plataforma.",
  User: "Usuário administrativo ou operacional pertencente a um tenant.",
  UserStoreAssignment: "Vínculo de acesso de usuário a uma loja e perfil.",
  AccessProfile: "Perfil configurável de autorização, global ou por loja.",
  Permission: "Permissão atômica de recurso e ação.",
  AccessProfilePermission: "Associação N:N entre perfil e permissão.",
  SessionToken: "Sessão/refresh token com revogação e expiração.",
  PasswordResetToken: "Token de primeiro acesso ou redefinição de senha.",
  AccessAuditEvent: "Trilha de auditoria de autenticação e autorização.",
  LayoutPreset: "Preset de layout reutilizável em superfícies do produto.",
  StoreVisualConfiguration: "Versão da identidade visual publicada ou em edição da loja.",
  Category: "Categoria de produtos do cardápio.",
  Product: "Produto vendável, com preço e disponibilidade.",
  ProductExternalMapping: "Mapeamento entre produto interno e identificador de plataforma externa.",
  Order: "Pedido comercial e seus dados operacionais e financeiros.",
  OrderItem: "Item vendido dentro de um pedido.",
  OrderItemModification: "Remoção de ingrediente ou inclusão de complemento no item.",
  ServiceTab: "Comanda que agrega pedidos e pagamentos.",
  OrderMaintenance: "Alteração auditável aplicada a pedido existente.",
  OrderOperationalEvent: "Evento cronológico do ciclo operacional de pedido/comanda/pagamento.",
  ProductComplement: "Complemento opcional de produto e seu impacto de preço.",
  ProductComplementAssignment: "Disponibilidade de complemento por produto.",
  SalesIntegration: "Conexão de importação de vendas com um provedor externo.",
  SalesIntegrationCredential: "Credencial cifrada e ciclo de validade da integração de vendas.",
  SalesImportRun: "Execução delimitada de preview ou importação de vendas.",
  SalesImportDay: "Estado e evidências de um dia dentro de uma importação.",
  ExternalSalesMovement: "Movimento externo classificado, normalizado e eventualmente ligado a pedido.",
  ExternalSaleIdentity: "Identidade idempotente global de venda externa.",
  OAuthAuthorizationAttempt: "Tentativa temporária de autorização OAuth/PKCE.",
  ProviderTransactionState: "Estado canônico mais recente de uma transação no provedor.",
  ProviderNotification: "Webhook recebido, validado e processado de forma idempotente.",
  IntegrationAuditEvent: "Auditoria de ações e resultados da integração.",
  PlatformIntegrationConfiguration: "Configuração central cifrada de um provedor.",
  PaymentTerminal: "Terminal físico habilitado para cobranças.",
  PaymentCharge: "Tentativa de cobrança associada a pedido ou comanda.",
  Payment: "Pagamento confirmado e seus identificadores externos.",
  PaymentAllocation: "Rateio de um pagamento entre alvos comerciais.",
  PaymentProviderEvent: "Evento bruto/idempotente recebido do provedor de pagamento.",
  PaymentException: "Divergência de pagamento que requer tratamento operacional.",
  IdempotencyRecord: "Resultado reutilizável de uma operação protegida por chave idempotente.",
  FinancialConfiguration: "Preferências financeiras do tenant.",
  PurchaseUnit: "Unidade de compra e conversão para estoque.",
  Supplier: "Fornecedor do tenant.",
  FinancialAccount: "Conta usada na movimentação de caixa/banco.",
  PaymentInstitutionConfiguration: "Instituição/meio e regras de liquidação configuradas.",
  FinancialCategory: "Classificação hierárquica de lançamentos financeiros.",
  PayableRecurrence: "Regra que origina contas a pagar recorrentes.",
  Payable: "Título de conta a pagar e seu fluxo de vencimento/pagamento.",
  PayablePayment: "Baixa parcial ou total de uma conta a pagar.",
  CashMovement: "Movimento de entrada, saída ou transferência entre contas.",
  FinancialAudit: "Auditoria de operações do módulo financeiro.",
  OrderPlatform: "Canal/plataforma de origem de pedidos.",
  DeliveryIntegration: "Configuração por loja de integração delivery.",
  DeliveryIntegrationCredential: "Credencial cifrada do provedor delivery.",
  DeliveryPlatformEvent: "Evento externo delivery persistido para processamento.",
  PlatformOrderLink: "Vínculo idempotente entre pedido interno e pedido externo.",
  PlatformSyncAttempt: "Tentativa e resultado de sincronização com marketplace.",
  PlatformCancellationReason: "Motivo de cancelamento aceito pela plataforma.",
  PlatformDispute: "Disputa associada a pedido externo.",
  DeliveryIntegrationAudit: "Auditoria operacional da integração delivery.",
  Ingredient: "Insumo estocável e unidade de medida.",
  TechnicalSheet: "Ficha técnica versionada de um produto.",
  TechnicalSheetLine: "Consumo de ingrediente definido na ficha técnica.",
  ProductCostSnapshot: "Fotografia do custo calculado de um produto.",
  StockMovement: "Movimentação de estoque vinculável a pedido/item.",
  OrderProfitabilitySnapshot: "Fotografia financeira da rentabilidade do pedido.",
  ExportJob: "Solicitação e artefato de exportação assíncrona.",
  BackgroundJob: "Fila durável de trabalho, com prioridade, lease e retry.",
  BackgroundJobAttempt: "Histórico de cada tentativa de execução de job.",
  OperationalNotification: "Notificação operacional com severidade, leitura e expiração.",
};

function blocks(kind) {
  const result = [];
  const matcher = new RegExp(`^${kind}\\s+(\\w+)\\s*\\{`, "gm");
  for (const match of schema.matchAll(matcher)) {
    const start = match.index + match[0].length;
    let depth = 1;
    let cursor = start;
    while (cursor < schema.length && depth > 0) {
      if (schema[cursor] === "{") depth += 1;
      if (schema[cursor] === "}") depth -= 1;
      cursor += 1;
    }
    result.push({ name: match[1], body: schema.slice(start, cursor - 1).trim() });
  }
  return result;
}

const enums = blocks("enum").map((entry) => ({
  ...entry,
  values: entry.body.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("//")),
}));
const enumNames = new Set(enums.map((entry) => entry.name));
const models = blocks("model");
const modelNames = new Set(models.map((entry) => entry.name));

function parseModel(model) {
  const lines = model.body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const directives = lines.filter((line) => line.startsWith("@@"));
  const fields = lines.filter((line) => !line.startsWith("//") && !line.startsWith("@@")).map((line) => {
    const match = line.match(/^(\w+)\s+([^\s]+)(?:\s+(.*))?$/);
    if (!match) return null;
    const [, name, declaredType, attributes = ""] = match;
    const list = declaredType.endsWith("[]");
    const optional = declaredType.endsWith("?");
    const baseType = declaredType.replace(/[\[\]?]/g, "");
    const relation = attributes.match(/@relation(?:\("([^"]+)"\))?(?:\([^)]*fields:\s*\[([^\]]+)\][^)]*references:\s*\[([^\]]+)\][^)]*\))?/);
    const isRelation = modelNames.has(baseType);
    const map = isRelation ? "—" : attributes.match(/@map\("([^"]+)"\)/)?.[1] ?? name;
    return { name, declaredType, baseType, attributes, list, optional, map, relation, isRelation };
  }).filter(Boolean);
  const table = directives.find((line) => line.startsWith("@@map"))?.match(/"([^"]+)"/)?.[1] ?? model.name;
  return { ...model, fields, directives, table };
}

const parsedModels = models.map(parseModel);
const domainByModel = new Map(domains.flatMap(([domain, names]) => names.map((name) => [name, domain])));

function escapeCell(value = "") {
  return String(value).replaceAll("|", "\\|").replace(/\s+/g, " ").trim() || "—";
}

function constraint(field) {
  const values = [];
  if (field.attributes.includes("@id")) values.push("PK");
  if (field.attributes.includes("@unique")) values.push("UNIQUE");
  const defaultValue = field.attributes.match(/@default\((.+?)\)(?=\s+@|$)/)?.[1];
  if (defaultValue) values.push(`default: ${defaultValue}`);
  if (field.isRelation) values.push(field.list ? "relação 1:N/N:N" : "FK/relação");
  return values.join("; ") || "—";
}

function description(field) {
  if (field.isRelation) return field.list ? `Coleção relacionada de ${field.baseType}.` : `Referência relacionada a ${field.baseType}.`;
  if (field.name === "id") return "Identificador único do registro.";
  if (field.name === "tenantId") return "Tenant proprietário; obrigatório para isolamento dos dados.";
  if (field.name.endsWith("Id")) return `Identificador associado a ${field.name.slice(0, -2)}.`;
  if (field.name === "createdAt") return "Data e hora de criação.";
  if (field.name === "updatedAt") return "Data e hora da última atualização.";
  if (field.name.endsWith("At")) return `Data e hora de ${field.name.slice(0, -2)}.`;
  if (field.name.endsWith("Date")) return `Data de ${field.name.slice(0, -4)}.`;
  if (field.name.startsWith("is") || field.baseType === "Boolean") return "Indicador verdadeiro/falso da condição nomeada.";
  if (field.name === "status") return "Estado atual no ciclo de vida da entidade.";
  if (field.name === "version") return "Versão usada para controle de concorrência ou evolução.";
  if (field.name === "metadata" || field.name.endsWith("Payload") || field.name.endsWith("Data")) return "Estrutura JSON com dados complementares controlados pelo domínio.";
  if (enumNames.has(field.baseType)) return `Valor controlado pelo enum ${field.baseType}.`;
  return `Atributo ${field.name} da entidade.`;
}

const out = [];
const add = (...lines) => out.push(...lines);
add(
  "# Dicionário de dados — BurgoOS",
  "",
  "> Fonte de verdade estrutural: `packages/database/prisma/schema.prisma`.",
  "> Documento gerado por `node scripts/generate-data-dictionary.mjs`; complemente a semântica no gerador para preservar alterações.",
  "",
  "## Escopo e leitura",
  "",
  `Este catálogo descreve o modelo PostgreSQL atual exposto pelo Prisma: **${parsedModels.length} entidades** e **${enums.length} enums**. Ele documenta nomes lógicos e físicos, tipos, nulabilidade, chaves, defaults, relacionamentos, índices e finalidade de negócio. Não registra valores de credenciais, dados pessoais reais nem conteúdo de produção.`,
  "",
  "### Convenções",
  "",
  "- `tenantId` identifica o proprietário SaaS; consultas de negócio devem sempre respeitar esse escopo.",
  "- IDs de entidades são normalmente UUID; identificadores externos permanecem `String` para preservar o formato do provedor.",
  "- `DateTime` representa instante UTC na aplicação; conversões de dia comercial usam `America/Sao_Paulo`.",
  "- `Decimal(p,s)` é obrigatório para valores monetários e quantidades que não toleram erro binário.",
  "- Campos `Json` são fronteiras flexíveis; entradas externas devem ser validadas e dados sensíveis devem ser redigidos/cifrados.",
  "- Sufixo `Ciphertext` indica conteúdo cifrado; nunca deve ser retornado por APIs ou logs.",
  "- Exclusão lógica usa `deletedAt`; relações Prisma indicam `Cascade`, `Restrict` ou `SetNull` quando aplicável.",
  "- `createdAt`/`updatedAt` representam auditoria técnica; datas do provedor permanecem em campos próprios.",
  "",
  "## Mapa de domínios",
  "",
  "| Domínio | Entidades |",
  "|---|---|"
);
for (const [domain, names] of domains) add(`| ${domain} | ${names.map((name) => `\`${name}\``).join(", ")} |`);
add("", "## Relações centrais", "", "```mermaid", "erDiagram", "  Tenant ||--o{ User : possui", "  Tenant ||--o{ Product : cataloga", "  Tenant ||--o{ Order : recebe", "  Order ||--|{ OrderItem : contem", "  ServiceTab ||--o{ Order : agrega", "  SalesIntegration ||--o{ SalesImportRun : executa", "  SalesImportRun ||--o{ ExternalSalesMovement : encontra", "  ExternalSalesMovement o|--o| Order : origina", "  DeliveryIntegration ||--o{ DeliveryPlatformEvent : recebe", "  Order ||--o{ PaymentCharge : cobra", "  Payment ||--o{ PaymentAllocation : distribui", "  Payable ||--o{ PayablePayment : liquida", "  Product ||--o| TechnicalSheet : custeia", "  Ingredient ||--o{ StockMovement : movimenta", "  BackgroundJob ||--o{ BackgroundJobAttempt : tenta", "```", "", "## Catálogo de entidades");

for (const [domain] of domains) {
  add("", `### ${domain}`);
  for (const model of parsedModels.filter((entry) => domainByModel.get(entry.name) === domain)) {
    add("", `#### ${model.name}`, "", `**Tabela física**: \`${model.table}\`  `, `**Finalidade**: ${purposes[model.name] ?? "Entidade persistente do domínio."}`, "", "| Campo lógico | Coluna física | Tipo Prisma | Obrigatório | Regra/Chave | Descrição |", "|---|---|---|---|---|---|");
    for (const field of model.fields) add(`| \`${field.name}\` | \`${field.map}\` | \`${escapeCell(field.declaredType)}\` | ${field.list ? "coleção" : field.optional ? "não" : "sim"} | ${escapeCell(constraint(field))} | ${escapeCell(description(field))} |`);
    const structural = model.directives.filter((line) => !line.startsWith("@@map"));
    if (structural.length) add("", "**Restrições e índices do modelo**:", "", ...structural.map((line) => `- \`${line}\``));
    const owned = model.fields.find((field) => field.name === "tenantId");
    add("", `**Escopo de tenant**: ${owned ? "próprio (`tenantId`)" : model.name === "Tenant" ? "raiz do isolamento" : "global ou derivado por relacionamento"}.`);
  }
}

const uncategorized = parsedModels.filter((entry) => !domainByModel.has(entry.name));
if (uncategorized.length) add("", "### Entidades ainda não categorizadas", "", ...uncategorized.map((entry) => `- \`${entry.name}\``));

add("", "## Catálogo de enums");
for (const entry of enums) add("", `### ${entry.name}`, "", `Valores permitidos: ${entry.values.map((value) => `\`${value}\``).join(", ")}.`);

add("", "## Relacionamentos e integridade", "", "| Origem | Campo | Destino | Cardinalidade | Configuração Prisma |", "|---|---|---|---|---|");
for (const model of parsedModels) {
  for (const field of model.fields.filter((candidate) => candidate.isRelation)) {
    add(`| \`${model.name}\` | \`${field.name}\` | \`${field.baseType}\` | ${field.list ? "muitos" : field.optional ? "zero ou um" : "um"} | \`${escapeCell(field.attributes)}\` |`);
  }
}

add("", "## Governança e manutenção", "", "1. Altere primeiro `packages/database/prisma/schema.prisma` e crie a migration correspondente.", "2. Atualize no gerador a finalidade de qualquer entidade nova e sua classificação de domínio.", "3. Execute `node scripts/generate-data-dictionary.mjs`.", "4. Execute `npx prisma validate --schema packages/database/prisma/schema.prisma` e revise o diff deste documento.", "5. Não documente segredos, tokens, payloads reais ou dados pessoais; registre apenas estrutura e semântica.", "", "## Limitações", "", "- O dicionário descreve o estado estrutural atual, não substitui contratos OpenAPI nem regras detalhadas das especificações de feature.", "- Descrições de campos não triviais são inferidas pelo nome; regras críticas devem permanecer também no plano/spec do domínio.", "- Índices criados exclusivamente por SQL manual devem ser conferidos nas migrations quando não estiverem representados no Prisma.", "");

await writeFile(outputPath, `${out.join("\n")}\n`, "utf8");
console.log(`Generated ${path.relative(root, outputPath)} with ${parsedModels.length} models and ${enums.length} enums.`);
