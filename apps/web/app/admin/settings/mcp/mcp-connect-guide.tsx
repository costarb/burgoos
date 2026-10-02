"use client";

import React, { useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";

const CLIENT_STEPS: Array<{ key: string; label: string; steps: string[] }> = [
  {
    key: "claude",
    label: "Claude (web, Desktop e celular)",
    steps: [
      "Abra Configuracoes > Conectores e clique em Adicionar conector personalizado.",
      "Cole o endereco do servidor e clique em Adicionar.",
      "Clique em Conectar, entre com seu login do RRFive OS, escolha a loja e autorize.",
    ],
  },
  {
    key: "claude-code",
    label: "Claude Code",
    steps: [
      "No terminal: claude mcp add --transport http rrfive <endereco do servidor>",
      "Abra o Claude Code, digite /mcp, escolha rrfive e Authenticate.",
      "Entre com seu login do RRFive OS, escolha a loja e autorize.",
    ],
  },
  {
    key: "chatgpt",
    label: "ChatGPT",
    steps: [
      "Em Configuracoes > Apps e conectores, ative o modo desenvolvedor e crie um conector.",
      "Cole o endereco do servidor e escolha autenticacao OAuth.",
      "Entre com seu login do RRFive OS, escolha a loja e autorize.",
    ],
  },
];

export function McpConnectGuide({ serverUrl, enabled }: { serverUrl: string; enabled: boolean }) {
  const [client, setClient] = useState(CLIENT_STEPS[0].key);
  const [copied, setCopied] = useState(false);
  const active = CLIENT_STEPS.find((item) => item.key === client) ?? CLIENT_STEPS[0];

  async function copy() {
    try {
      await navigator.clipboard.writeText(serverUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Link2 aria-hidden className="h-5 w-5" /> Conectar pelo endereco
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        A forma mais simples: cole este endereco no assistente e entre com seu login. Nao e preciso
        copiar tokens nem editar arquivos.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm" data-testid="mcp-server-url">
          {serverUrl}
        </code>
        <button
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          onClick={copy}
          type="button"
        >
          {copied ? <Check aria-hidden className="h-4 w-4" /> : <Copy aria-hidden className="h-4 w-4" />}
          {copied ? "Copiado" : "Copiar endereco"}
        </button>
      </div>

      {!enabled ? (
        <p className="mt-3 text-sm text-amber-800">Habilite o MCP da loja para que a conexao funcione.</p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2" role="tablist">
        {CLIENT_STEPS.map((item) => (
          <button
            aria-selected={item.key === client}
            className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${
              item.key === client ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
            key={item.key}
            onClick={() => setClient(item.key)}
            role="tab"
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700" data-testid="mcp-connect-steps">
        {active.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-slate-500">
        Quem conecta precisa da permissao &quot;Usar assistentes de IA&quot;. Cada conexao acessa uma unica
        loja, escolhida na hora de autorizar.
      </p>
    </section>
  );
}
