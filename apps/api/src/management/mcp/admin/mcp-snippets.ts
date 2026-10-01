export interface McpConfigurationSnippets {
  inspector: string;
  claudeCode: string;
  claudeDesktop: string;
  claudeDesktopWindows: string;
  cursor: string;
}

/**
 * Builds ready-to-paste client configurations for a store token. Claude Desktop passes the
 * header through an environment variable so the space in "Bearer <token>" never reaches the
 * command line (mcp-remote's recommended form, required on Windows).
 */
export function buildMcpSnippets(input: {
  serverUrl: string;
  token: string;
  storeSlug: string;
}): McpConfigurationSnippets {
  const serverName = `rrfive-${input.storeSlug}`;
  const authorization = `Bearer ${input.token}`;
  const headerArgs = ["--header", "Authorization:${AUTH_HEADER}"];
  const env = { AUTH_HEADER: authorization };

  return {
    inspector: [
      "npx @modelcontextprotocol/inspector",
      "",
      "Transport: Streamable HTTP",
      `URL: ${input.serverUrl}`,
      `Header: Authorization = ${authorization}`,
    ].join("\n"),
    claudeCode: `claude mcp add --transport http ${serverName} ${input.serverUrl} --header "Authorization: ${authorization}"`,
    claudeDesktop: json({
      mcpServers: {
        [serverName]: {
          command: "npx",
          args: ["-y", "mcp-remote", input.serverUrl, ...headerArgs],
          env,
        },
      },
    }),
    claudeDesktopWindows: json({
      mcpServers: {
        [serverName]: {
          command: "cmd",
          args: ["/c", "npx", "-y", "mcp-remote", input.serverUrl, ...headerArgs],
          env,
        },
      },
    }),
    cursor: json({
      mcpServers: {
        [serverName]: {
          url: input.serverUrl,
          headers: { Authorization: authorization },
        },
      },
    }),
  };
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
