# Quickstart: Testar os Conectores com Login (OAuth)

**Feature**: `026-mcp-oauth-connectors`

## 1. Ambiente

```env
MCP_PUBLIC_URL=http://localhost:3001/api/mcp   # produção: https://<api>/api/mcp
WEB_PUBLIC_URL=http://localhost:3000           # produção: https://<web>
```

```bash
npm run db:migrate      # aplica 20261002090000_mcp_oauth_connectors
npm run local:up
```

Os conectores do claude.ai e do ChatGPT exigem servidor público com HTTPS. Localmente, valide com o **MCP Inspector** e o **Claude Code**, que fazem o fluxo OAuth pela máquina local. Valide claude.ai e ChatGPT em homologação ou produção.

## 2. Descoberta (sem login)

```bash
curl -i -X POST http://localhost:3001/api/mcp -H "Content-Type: application/json" -d '{}'
# 401 + WWW-Authenticate: Bearer ... resource_metadata="http://localhost:3001/.well-known/oauth-protected-resource"
curl -s http://localhost:3001/.well-known/oauth-protected-resource
curl -s http://localhost:3001/.well-known/oauth-authorization-server
```

## 3. MCP Inspector (fluxo completo, local)

1. `npx @modelcontextprotocol/inspector`. Transport **Streamable HTTP**, URL `http://localhost:3001/api/mcp`, **sem** header Authorization.
2. Clique em **Connect**. O Inspector descobre o servidor de autorização e abre a tela **Conectar assistente** do RRFive OS.
3. Faça login (se necessário), escolha a loja e clique em **Autorizar**.
4. De volta ao Inspector: **List Tools** mostra as tools das áreas liberadas.

## 4. Claude Code (local)

```bash
claude mcp add --transport http rrfive-oauth http://localhost:3001/api/mcp
claude    # depois, /mcp → rrfive-oauth → Authenticate
```

## 5. claude.ai / Claude Desktop (produção)

Configurações → Conectores → **Adicionar conector personalizado** → URL `https://<api>/api/mcp` → **Conectar** → login → loja → **Autorizar**. Pergunte: *"Qual foi o faturamento de setembro e quais produtos tiveram melhor margem?"*

## 6. ChatGPT (produção)

Configurações → Apps/Conectores → modo desenvolvedor → **Criar** → URL `https://<api>/api/mcp`, autenticação **OAuth** → login → loja → **Autorizar**.

## 7. Aceite

| # | Ação | Esperado |
|---|---|---|
| 1 | Usuário sem a permissão "Usar assistentes de IA" tenta autorizar | Mensagem explicando que precisa da permissão; sem botão Autorizar |
| 2 | Loja com MCP desabilitado | Não aparece na lista de lojas |
| 3 | Cancelar no consentimento | O cliente informa acesso negado; nenhuma conexão criada |
| 4 | Revogar a conexão em MCP / IA → Conexões autorizadas | A próxima chamada pede nova autorização |
| 5 | Desabilitar o MCP da loja | Chamadas OAuth e tokens da fase 1 recusados |
| 6 | Inativar o usuário que autorizou | Chamadas da conexão recusadas |
| 7 | Conexão da loja A | Nunca retorna dados da loja B, mesmo com o usuário tendo acesso às duas |
| 8 | Token `rrf_mcp_` da fase 1 no Claude Desktop | Continua funcionando |
| 9 | Aba Uso | Chamadas OAuth aparecem com aplicativo e usuário |
| 10 | Auditoria de acessos | Eventos de autorização, negação e revogação |
