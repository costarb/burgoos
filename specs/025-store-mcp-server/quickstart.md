# Quickstart: Testar o MCP Server por Loja

**Feature**: `025-store-mcp-server`

Roteiro de validação manual da fase 1. Os testes automatizados estão descritos no [plan.md](./plan.md#test-strategy).

## 1. Preparar o ambiente

```bash
npm install
npm run db:up
npm run db:migrate          # aplica 20261001090000_store_mcp_server
npm run local:up            # API em http://localhost:3001, web em http://localhost:3000
```

Opcional no `.env`:

```env
MCP_PUBLIC_URL=http://localhost:3001/api/mcp
MCP_RATE_LIMIT_PER_MINUTE=60
MCP_TOOL_TIMEOUT_MS=20000
```

Use uma base com ao menos **duas lojas** com vendas, DRE e contas a pagar (`npm run memory:seed` gera dados representativos).

## 2. Habilitar e gerar token (US1)

1. Entrar no admin com o administrador da **Loja A**.
2. Menu **Configuracoes → MCP / IA**. Conferir: estado **Desabilitado**, nenhum token.
3. Clicar em **Habilitar**. Conferir que todas as áreas aparecem ligadas.
4. **Gerar token**: nome "Teste local", validade 30 dias.
5. Copiar o token (`rrf_mcp_…`) e os trechos exibidos. Fechar o aviso e conferir que a lista mostra só o prefixo.
6. Repetir na **Loja B** (usuário master trocando a loja ativa, ou o administrador da Loja B).

## 3. Validar com o MCP Inspector (US2)

```bash
npx @modelcontextprotocol/inspector
```

- Transport: **Streamable HTTP**. URL: `http://localhost:3001/api/mcp`
- Header: `Authorization` = `Bearer <token da Loja A>`
- **Connect** → aba **Tools** → **List Tools**: 10 tools com descrições em português.
- Executar `resumo_vendas` com `inicio=2026-09-01`, `fim=2026-09-30` e comparar com **Relatórios → Vendas** no mesmo período.
- Executar `dre` para setembro e comparar com **Relatórios → DRE**.
- Executar `resumo_vendas` com `inicio=2026-01-01`, `fim=2026-09-30`: deve retornar erro `PERIOD_TOO_LONG`.
- Aba **Resources**: ler `perfil_loja` e `glossario_metricas`.
- Aba **Prompts**: listar os 4 modelos de análise.

## 4. Usar com um assistente de IA

**Claude Code**

```bash
claude mcp add --transport http rrfive-loja-a http://localhost:3001/api/mcp \
  --header "Authorization: Bearer <token da Loja A>"
```

Perguntar: *"Compare as vendas de setembro com agosto e aponte os produtos com pior margem."*

**Claude Desktop** (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "rrfive-loja-a": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:3001/api/mcp",
               "--header", "Authorization: Bearer <token da Loja A>"]
    }
  }
}
```

**Cursor** (`~/.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "rrfive-loja-a": {
      "url": "http://localhost:3001/api/mcp",
      "headers": { "Authorization": "Bearer <token da Loja A>" }
    }
  }
}
```

## 5. Segurança e controle (US3, US4)

| # | Ação | Esperado |
|---|---|---|
| 1 | Com o token da Loja A, executar todas as tools | Nenhum dado da Loja B (comparar nomes de produtos e totais) |
| 2 | Revogar o token na tela e repetir uma chamada | `401` |
| 3 | Gerar novo token, desabilitar o MCP, chamar | `401`. Reabilitar: volta a funcionar |
| 4 | Desligar a área **Estoque**, reconectar | `estoque` some da lista |
| 5 | Tentar desligar todas as áreas | Tela impede e explica |
| 6 | Chamar com `Bearer rrf_mcp_invalido` | `401`, mesma mensagem dos casos acima |
| 7 | Inspecionar as respostas | Sem nome, telefone, endereço ou documento de cliente |
| 8 | Disparar mais de 60 chamadas em 1 minuto | `429` com mensagem em português |

## 6. Log de uso (US5)

Na tela **MCP / IA → Uso**: conferir as chamadas dos passos anteriores (tool, parâmetros, resultado, duração), as recusas marcadas como **Recusada**, os filtros por token e período, e o "último uso" atualizado na lista de tokens. Em **Acessos → Auditoria**: eventos de habilitação, geração e revogação.

## 7. Uso fora da máquina local

Publicar a API com HTTPS e definir `MCP_PUBLIC_URL=https://<api>/api/mcp`. Os trechos gerados na tela passam a usar esse endereço.
