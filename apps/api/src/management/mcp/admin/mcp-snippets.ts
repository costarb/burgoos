export interface McpConfigurationSnippets {
  inspector: string;
  claudeCode: string;
  claudeDesktop: string;
  cursor: string;
}

/** Builds ready-to-paste client configurations for a store token. */
export function buildMcpSnippets(input: {
  serverUrl: string;
  token: string;
  storeSlug: string;
}): McpConfigurationSnippets {
  const serverName = `rrfive-${input.storeSlug}`;
  const authorization = `Bearer ${input.token}`;

  return {
    inspector: [
      "npx @modelcontextprotocol/inspector",
      "",
      "Transport: Streamable HTTP",
      `URL: ${input.serverUrl}`,
      `Header: Authorization = ${authorization}`,
    ].join("\n"),
    claudeCode: `claude mcp add --transport http ${serverName} ${input.serverUrl} --header "Authorization: ${authorization}"`,
    claudeDesktop: JSON.stringify(
      {
        mcpServers: {
          [serverName]: {
            command: "npx",
            args: ["mcp-remote", input.serverUrl, "--header", `Authorization: ${authorization}`],
          },
        },
      },
      null,
      2
    ),
    cursor: JSON.stringify(
      {
        mcpServers: {
          [serverName]: {
            url: input.serverUrl,
            headers: { Authorization: authorization },
          },
        },
      },
      null,
      2
    ),
  };
}
