import { INestApplication } from "@nestjs/common";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMcpFakePrisma } from "./support/mcp-fake-prisma";
import {
  ALL_TOOL_CALLS,
  connectClient,
  createMcpServerApp,
  createServiceMocks,
  listen,
  PLANTED_PII,
  seedStore,
  seedToken,
  STORE_A,
} from "./support/mcp-service-fixtures";

const FORBIDDEN_KEY = /customer|phone|telefone|address|endereco|document|cpf|cnpj|email|token|secret|password|notes|bank|agency|account(Id)?$/i;

function collectKeys(value: unknown, keys: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((item) => collectKeys(item, keys));
  else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      keys.push(key);
      collectKeys(item, keys);
    }
  }
  return keys;
}

/** SC-006: no customer personal data or secrets in any MCP response. */
describe("MCP privacy", () => {
  let app: INestApplication;
  let client: Client;
  const prisma = createMcpFakePrisma();

  beforeAll(async () => {
    app = await createMcpServerApp(prisma, createServiceMocks());
    const url = await listen(app);
    seedStore(prisma, STORE_A);
    client = await connectClient(url, seedToken(prisma, STORE_A).token);
  });

  afterAll(async () => {
    await client?.close();
    await app?.close();
  });

  it("never returns planted personal data, document references or bank details", async () => {
    const outputs: unknown[] = [];
    for (const call of ALL_TOOL_CALLS) outputs.push((await client.callTool(call)).structuredContent);
    outputs.push(await client.readResource({ uri: "rrfive://loja/perfil" }));
    const serialized = JSON.stringify(outputs);

    for (const value of Object.values(PLANTED_PII)) expect(serialized).not.toContain(value);
    expect(serialized).not.toMatch(/CNPJ|Agencia|conta 12345/);
  });

  it("uses no forbidden field names in structured outputs", async () => {
    for (const call of ALL_TOOL_CALLS) {
      const result = await client.callTool(call);
      const forbidden = collectKeys(result.structuredContent).filter((key) => FORBIDDEN_KEY.test(key));
      expect(forbidden, call.name).toEqual([]);
    }
  });
});
