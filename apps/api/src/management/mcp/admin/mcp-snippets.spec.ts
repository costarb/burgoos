import { describe, expect, it } from "vitest";
import { buildMcpSnippets } from "./mcp-snippets";

describe("buildMcpSnippets", () => {
  const snippets = buildMcpSnippets({
    serverUrl: "https://api.example.com/api/mcp",
    token: "rrf_mcp_abc",
    storeSlug: "loja-centro",
  });

  it("fills the server url and the full token in every client snippet", () => {
    for (const snippet of Object.values(snippets)) {
      expect(snippet).toContain("https://api.example.com/api/mcp");
      expect(snippet).toContain("Bearer rrf_mcp_abc");
    }
    expect(snippets.claudeCode).toBe(
      'claude mcp add --transport http rrfive-loja-centro https://api.example.com/api/mcp --header "Authorization: Bearer rrf_mcp_abc"'
    );
  });

  it("passes the Claude Desktop header through an environment variable", () => {
    const header = ["--header", "Authorization:${AUTH_HEADER}"];
    expect(JSON.parse(snippets.claudeDesktop)).toEqual({
      mcpServers: {
        "rrfive-loja-centro": {
          command: "npx",
          args: ["-y", "mcp-remote", "https://api.example.com/api/mcp", ...header],
          env: { AUTH_HEADER: "Bearer rrf_mcp_abc" },
        },
      },
    });
    expect(JSON.parse(snippets.claudeDesktopWindows)).toEqual({
      mcpServers: {
        "rrfive-loja-centro": {
          command: "cmd",
          args: ["/c", "npx", "-y", "mcp-remote", "https://api.example.com/api/mcp", ...header],
          env: { AUTH_HEADER: "Bearer rrf_mcp_abc" },
        },
      },
    });
  });

  it("produces valid JSON for Cursor", () => {
    expect(JSON.parse(snippets.cursor)).toEqual({
      mcpServers: {
        "rrfive-loja-centro": {
          url: "https://api.example.com/api/mcp",
          headers: { Authorization: "Bearer rrf_mcp_abc" },
        },
      },
    });
  });
});
