import { PrismaClient } from "@prisma/client";

const sourceUrl = process.env.SOURCE_DATABASE_URL;
let targetUrl = process.env.TARGET_DATABASE_URL;

if (!sourceUrl || !targetUrl) {
  console.error("SOURCE_DATABASE_URL and TARGET_DATABASE_URL are required.");
  process.exit(1);
}

if (!targetUrl.includes("sslmode=")) {
  targetUrl += targetUrl.includes("?") ? "&sslmode=require" : "?sslmode=require";
}

const source = new PrismaClient({
  datasources: { db: { url: sourceUrl } },
});
const target = new PrismaClient({
  datasources: { db: { url: targetUrl } },
});

const tables = [
  "layout_presets",
  "tenants",
  "platform_users",
  "users",
  "store_visual_configurations",
  "financial_configurations",
  "purchase_units",
  "order_platforms",
  "categories",
  "products",
  "suppliers",
  "financial_accounts",
  "financial_categories",
  "ingredients",
  "technical_sheets",
  "technical_sheet_lines",
  "product_cost_snapshots",
  "orders",
  "order_maintenances",
  "order_items",
  "stock_movements",
  "order_profitability_snapshots",
  "payable_recurrences",
  "payables",
  "payable_payments",
  "cash_movements",
  "financial_audits",
];

if (process.env.LIST_TABLES_ONLY === "1") {
  const rows = await target.$queryRawUnsafe(
    `
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name
    `
  );
  console.table(rows);
  await target.$disconnect();
  process.exit(0);
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function tableColumns(client, table) {
  const rows = await client.$queryRawUnsafe(
    `
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
      ORDER BY ordinal_position
    `,
    table
  );

  return rows.map((row) => ({
    name: row.column_name,
    dataType: row.data_type,
    udtName: row.udt_name,
  }));
}

function placeholderFor(column, index) {
  const placeholder = `$${index + 1}`;

  if (column.udtName === "uuid") {
    return `${placeholder}::uuid`;
  }

  if (column.udtName === "json" || column.udtName === "jsonb") {
    return `${placeholder}::${column.udtName}`;
  }

  if (column.dataType === "USER-DEFINED") {
    return `${placeholder}::${quoteIdentifier(column.udtName)}`;
  }

  return placeholder;
}

function valueFor(row, column) {
  const value = row[column.name];

  if (value === null || value === undefined) {
    return value;
  }

  if (column.udtName === "json" || column.udtName === "jsonb") {
    return JSON.stringify(value);
  }

  return value;
}

async function copyTable(table) {
  const columns = await tableColumns(source, table);
  if (columns.length === 0) {
    console.log(`skip ${table}: table not found in source`);
    return;
  }

  const rows = await source.$queryRawUnsafe(`SELECT * FROM ${quoteIdentifier(table)}`);

  if (rows.length === 0) {
    console.log(`copy ${table}: 0 rows`);
    return;
  }

  const columnSql = columns.map((column) => quoteIdentifier(column.name)).join(", ");
  const placeholders = columns.map(placeholderFor).join(", ");
  const insertSql = `
    INSERT INTO ${quoteIdentifier(table)} (${columnSql})
    VALUES (${placeholders})
  `;

  for (const row of rows) {
    await target.$executeRawUnsafe(
      insertSql,
      ...columns.map((column) => valueFor(row, column))
    );
  }

  console.log(`copy ${table}: ${rows.length} rows`);
}

async function main() {
  await source.$connect();
  await target.$connect();

  await source.$queryRaw`SELECT 1`;
  await target.$queryRaw`SELECT 1`;

  console.log("connected source and target");
  await target.$executeRawUnsafe(
    `TRUNCATE TABLE ${tables.map(quoteIdentifier).join(", ")} RESTART IDENTITY CASCADE`
  );
  console.log("target application tables truncated");

  for (const table of tables) {
    await copyTable(table);
  }
}

main()
  .then(async () => {
    await source.$disconnect();
    await target.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await source.$disconnect();
    await target.$disconnect();
    process.exit(1);
  });
