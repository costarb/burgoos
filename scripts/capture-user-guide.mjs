import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const baseUrl = process.env.USER_GUIDE_BASE_URL ?? "http://localhost:3000";
const email = process.env.USER_GUIDE_EMAIL;
const password = process.env.USER_GUIDE_PASSWORD;
const browserExecutable = process.env.USER_GUIDE_BROWSER_EXECUTABLE;
const outputDirectory = new URL("../docs/assets/user-guide/", import.meta.url);

function outputPath(name) {
  return fileURLToPath(new URL(name, outputDirectory));
}

if (!email || !password) {
  throw new Error(
    "Defina USER_GUIDE_EMAIL e USER_GUIDE_PASSWORD para capturar as telas autenticadas."
  );
}

const pages = [
  ["cardapio-publico", "/piloto"],
  ["painel", "/admin"],
  ["pedidos", "/admin/orders"],
  ["pdv", "/admin/pos"],
  ["comandas", "/admin/tabs"],
  ["catalogo", "/admin/catalog"],
  ["estoque", "/admin/inventory"],
  ["fluxo-de-caixa", "/admin/finance/cash-flow"],
  ["contas-a-pagar", "/admin/finance/payables"],
  ["relatorio-de-vendas", "/admin/reports/sales"],
  ["importacao-de-vendas", "/admin/orders/import"],
  ["integracoes-delivery", "/admin/integrations/delivery"],
  ["configuracoes", "/admin/settings"],
];

await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  ...(browserExecutable ? { executablePath: browserExecutable } : {}),
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
  locale: "pt-BR",
  timezoneId: "America/Sao_Paulo",
});
const page = await context.newPage();

page.setDefaultTimeout(90_000);
await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
await page.screenshot({ path: outputPath("login.png") });

await page.locator('input[name="email"]').fill(email);
await page.locator('input[name="password"]').fill(password);
await Promise.all([
  page.waitForURL(/\/(admin|platform)(\/|$)/, { timeout: 120_000 }),
  page.getByRole("button", { name: /entrar/i }).click(),
]);

for (const [name, path] of pages) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(2_000);
  await page.screenshot({ path: outputPath(`${name}.png`), fullPage: true });
  console.log(`captured ${path}`);
}

await browser.close();
