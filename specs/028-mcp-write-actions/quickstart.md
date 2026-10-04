# Quickstart: Ações pelo MCP

## Local

1. `npx prisma migrate deploy` (em `packages/database`, com o `.env` da raiz) e reiniciar API e web.
2. **Configurações > Assistentes de IA (MCP)**: ligar "Permitir ações pelos assistentes".
3. Conectar um cliente OAuth (MCP Inspector ou Claude Code com o conector) e, no consentimento, marcar "Permitir que o assistente execute ações". A conexão aparece como "Leitura e ações".
4. Contas a pagar:
   - "Lança o aluguel de R$ 3.000, categoria Aluguel, vencendo 10/11, competência novembro, mensal por 12 meses" → 12 contas na tela, auditoria com canal `MCP · <cliente>`.
   - Repetir o pedido → a tool avisa duplicidade.
   - Registrar pagamento parcial, editar o valor, cancelar outra conta com motivo.
5. Importação:
   - "Quais integrações de vendas eu tenho?" → `integracoes_de_vendas`.
   - "Importa as vendas do PagBank de ontem" → prévia, status com o resumo, confirmação; vendas em Pedidos; histórico com origem MCP.
   - Mercado Pago com `cargaInicialDias: 30`.
6. Negativos: token fixo (`rrf_mcp_`) não lista as ações; desligar "Permitir ações" → a próxima ação é recusada; usuário sem `finance.manage` → recusado.

## Produção

Repetir os passos 2–5 com Claude.ai ou ChatGPT, com um período pequeno na importação.
