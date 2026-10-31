# Quickstart: Módulo Fiscal — NFC-e

## Pré-requisitos

- Conta Bling da empresa habilitada para NFC-e em SP (certificado A1, CSC e série cadastrados no Bling), em homologação.
- App OAuth criado no Bling (client id/secret, redirect `https://burgoos-api.onrender.com/api/integrations/bling/callback`; em ambiente local, `http://localhost:3001/api/integrations/bling/callback`).
- Banco migrado: `npm run db:migrate` (migração `20261031100000_fiscal_nfce`) e seed atualizado.

## Validação manual (homologação)

1. **Plataforma** → Integrações → Bling: informar client id/secret.
2. **Admin da loja** → Configurações da loja: conferir o endereço completo (rua, número, bairro, cidade, UF = SP, CEP).
3. **Fiscal → Configuração**: razão social, CNPJ, IE; conferir o código IBGE resolvido. Conectar o Bling, escolher a natureza de operação e mapear cada forma de pagamento. Ambiente = Homologação; modo = Automático.
4. **Certificado A1:** nao se aplica ao Bling (usa o certificado da propria conta); o envio do .pfx esta adiado (US6).
5. **Fiscal → Perfis**: criar "Alimentação preparada" (CSOSN 102) como padrão da categoria; um perfil "Bebidas ST" (CSOSN 500 + CEST) num produto; conferir que "faltantes" está vazio. A prontidão deve ficar verde; ativar o fiscal.
6. **Balcão**: vender um lanche com um complemento pago, CPF informado, pagamento dividido (PIX + dinheiro com troco). Esperado: nota Autorizada em até 30 s, com dois itens, dois pagamentos e CPF; DANFE abre e imprime; XML baixa.
7. **Comanda**: abrir, lançar dois pedidos, fechar e pagar. Esperado: uma NFC-e com os itens dos dois pedidos.
8. **Cancelamento**: cancelar o pedido do passo 6. Esperado: nota "Cancelamento pendente — ação no provedor", com notificação e prazo. Cancelar no painel do Bling; em até 5 min a nota fica "Cancelada" no ERP.
9. **Guard**: tentar editar itens de um pedido autorizado → bloqueado.
10. **Importação automática**: ligar no Mercado Pago (produto fixo). Fazer uma venda na maquininha; em até 5 min aparecem o pedido importado e a nota autorizada. Conferir o log `sales.auto_import.cycle`.
11. **Falha simulada**: revogar o token do Mercado Pago → ciclos `failed`; após 3 ciclos, log `sales.auto_import.degraded` e notificação. Reconectar → volta a `success`.
12. **Retroativo**: importar manualmente uma venda de ontem → "Não emitida"; em **Fiscal → Vendas sem NFC-e**, escolher a data de ontem e emitir exige confirmação de risco.
13. **Modo manual**: com o modo Manual, fazer uma venda de balcão e pagar → ela aparece em **Fiscal → Vendas sem NFC-e**; **Emitir NFC-e** gera a nota.
13. **Exportação**: exportar o mês → ZIP sem as notas de homologação (com o ambiente em homologação, conferir que o ZIP vem vazio e com aviso).

## Testes automatizados

```bash
npm run test --workspace apps/api -- fiscal sales-auto-import
npm run test --workspace apps/web -- fiscal
npm run typecheck
```
