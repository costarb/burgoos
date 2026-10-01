import { INestApplication } from "@nestjs/common";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMcpFakePrisma, resetMcpFakePrisma } from "./support/mcp-fake-prisma";
import {
  ALL_TOOL_CALLS,
  connectClient,
  createMcpServerApp,
  createServiceMocks,
  listen,
  seedStore,
  seedToken,
  STORE_A,
  STORE_B,
  STORE_DATA,
} from "./support/mcp-service-fixtures";

/** SC-003: a store token never reads another store's data. */
describe("MCP tenant isolation", () => {
  let app: INestApplication;
  let url: string;
  let client: Client | null = null;
  const prisma = createMcpFakePrisma();
  const services = createServiceMocks();

  beforeAll(async () => {
    app = await createMcpServerApp(prisma, services);
    url = await listen(app);
  });

  beforeEach(() => {
    resetMcpFakePrisma(prisma);
    seedStore(prisma, STORE_A);
    seedStore(prisma, STORE_B);
    Object.values(services).forEach((service) =>
      Object.values(service).forEach((method) => method.mockClear())
    );
  });

  afterEach(async () => {
    await client?.close();
    client = null;
  });

  afterAll(async () => {
    await app?.close();
  });

  async function collectEverything(token: string): Promise<string> {
    client = await connectClient(url, token);
    const outputs: unknown[] = [];
    for (const call of ALL_TOOL_CALLS) outputs.push(await client.callTool(call));
    outputs.push(await client.readResource({ uri: "rrfive://loja/perfil" }));
    outputs.push(await client.readResource({ uri: "rrfive://glossario" }));
    outputs.push(client.getInstructions());
    return JSON.stringify(outputs);
  }

  function serviceTenantIds(): string[] {
    return Object.values(services).flatMap((service) =>
      Object.values(service).flatMap((method) => method.mock.calls.map((args) => args[0] as string))
    );
  }

  it.each([
    [STORE_A, STORE_B],
    [STORE_B, STORE_A],
  ] as const)("token of %s only reaches its own store", async (own, other) => {
    const everything = await collectEverything(seedToken(prisma, own).token);

    expect(everything).toContain(STORE_DATA[own].product);
    expect(everything).toContain(STORE_DATA[own].name);
    for (const marker of [
      STORE_DATA[other].name,
      STORE_DATA[other].product,
      STORE_DATA[other].platform,
      STORE_DATA[other].supplier,
      STORE_DATA[other].ingredient,
      STORE_DATA[other].account,
      STORE_DATA[other].category,
      other,
    ]) {
      expect(everything).not.toContain(marker);
    }

    const tenants = new Set(serviceTenantIds());
    expect([...tenants]).toEqual([own]);
  });

  it("does not accept a store parameter in any tool", async () => {
    client = await connectClient(url, seedToken(prisma, STORE_A).token);
    const { tools } = await client.listTools();

    for (const tool of tools) {
      const properties = Object.keys(
        (tool.inputSchema as { properties?: Record<string, unknown> }).properties ?? {}
      );
      expect(properties.some((name) => /store|tenant|loja/i.test(name))).toBe(false);
    }

    const result = await client.callTool({
      name: "dre",
      arguments: { inicio: "2026-09-01", fim: "2026-09-30", tenantId: STORE_B },
    });
    expect(JSON.stringify(result)).not.toContain(STORE_DATA[STORE_B].name);
    expect(new Set(serviceTenantIds())).toEqual(new Set([STORE_A]));
  });
});
