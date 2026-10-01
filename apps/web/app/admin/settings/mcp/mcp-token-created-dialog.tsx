"use client";

import React, { useState } from "react";
import type { CreatedMcpToken, McpConfigurationSnippets } from "@rrfive/types";
import { AlertTriangle, Check, Copy } from "lucide-react";
import { ModalShell } from "../../../../components/admin/modal-shell";

const SNIPPET_TABS: Array<{ key: keyof McpConfigurationSnippets; label: string; hint: string }> = [
  {
    key: "claudeCode",
    label: "Claude Code",
    hint: "Execute no terminal. O servidor fica disponivel em todas as sessoes do Claude Code.",
  },
  {
    key: "claudeDesktopWindows",
    label: "Claude Desktop (Windows)",
    hint: "Cole em claude_desktop_config.json (Configuracoes > Desenvolvedor > Editar configuracao) e reinicie o app pela bandeja do sistema. Se o arquivo ja tiver outros servidores, adicione apenas o bloco dentro de mcpServers.",
  },
  {
    key: "claudeDesktop",
    label: "Claude Desktop (macOS/Linux)",
    hint: "Cole em claude_desktop_config.json (Configuracoes > Desenvolvedor > Editar configuracao) e reinicie o app. Se o arquivo ja tiver outros servidores, adicione apenas o bloco dentro de mcpServers.",
  },
  {
    key: "cursor",
    label: "Cursor",
    hint: "Cole em ~/.cursor/mcp.json ou .cursor/mcp.json do projeto.",
  },
  {
    key: "inspector",
    label: "MCP Inspector",
    hint: "Use para conferir as ferramentas e os numeros retornados, sem LLM.",
  },
];

interface McpTokenCreatedDialogProps {
  created: CreatedMcpToken;
  onClose: () => void;
}

export function McpTokenCreatedDialog({ created, onClose }: McpTokenCreatedDialogProps) {
  const [tab, setTab] = useState<keyof McpConfigurationSnippets>("claudeCode");
  const active = SNIPPET_TABS.find((item) => item.key === tab) ?? SNIPPET_TABS[0];

  return (
    <ModalShell
      description="Copie o token agora. Por seguranca, ele nao sera exibido novamente."
      onClose={onClose}
      title={`Token "${created.name}" gerado`}
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Quem tiver este token consegue consultar os numeros desta loja. Guarde em local seguro
            e revogue se ele for exposto.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Token</p>
          <div className="mt-1 flex items-center gap-2">
            <code
              className="min-w-0 flex-1 break-all rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm"
              data-testid="mcp-created-token"
            >
              {created.token}
            </code>
            <CopyButton label="Copiar token" value={created.token} />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Configurar cliente</p>
          <div className="mt-2 flex flex-wrap gap-2" role="tablist">
            {SNIPPET_TABS.map((item) => (
              <button
                aria-selected={item.key === tab}
                className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${
                  item.key === tab
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
                key={item.key}
                onClick={() => setTab(item.key)}
                role="tab"
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-slate-600">{active.hint}</p>
          <div className="relative mt-2">
            <pre
              className="overflow-x-auto rounded-md bg-slate-950 p-4 pr-28 text-xs leading-relaxed text-slate-100"
              data-testid="mcp-snippet"
            >
              {created.snippets[active.key]}
            </pre>
            <div className="absolute right-2 top-2">
              <CopyButton label="Copiar" value={created.snippets[active.key]} />
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function CopyButton({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      onClick={copy}
      type="button"
    >
      {copied ? <Check aria-hidden className="h-4 w-4" /> : <Copy aria-hidden className="h-4 w-4" />}
      {copied ? "Copiado" : label}
    </button>
  );
}
