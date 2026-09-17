# Quickstart: Sincronização de Vendas Financeiras iFood

## Purpose

Validar consulta, preview, vínculo operacional, importação histórica, valores, retomada e gate de homologação sem registrar credenciais ou dados pessoais.

## Prerequisites

- Integração operacional iFood ativa para tenant de teste.
- Merchant autorizado para Financial.
- Produto consolidado ativo para histórico.
- Aplicação iFood e conta profissional aptas à homologação.
- Nunca versionar tokens, códigos, documentos, NSU ou dados bancários.

## Automated validation

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test --workspace @burgoos/api
npm.cmd run test --workspace @burgoos/web
```

Cobrir client/mapper, dedupe cruzado, repetição/concorrência, liability, parcelas, eventos, liquidações, dois tenants e regressão dos providers existentes.

## Local smoke test

1. Inicie pelo script padrão.
2. Entre como administrador de loja com iFood.
3. Abra importação e selecione iFood.
4. Vincule a conexão financeira à operacional.
5. Valide readiness em teste.
6. Consulte período com pedido existente, venda concluída ausente e cancelada.
7. Confirme as três classificações na prévia.
8. Escolha produto consolidado e confirme.
9. Verifique: existente somente enriquecido; um histórico criado; cancelado sem pedido; repetição sem duplicidade.

## Financial acceptance

| Scenario                           | Expected result               |
| ---------------------------------- | ----------------------------- |
| Online recebido pelo iFood         | Recebível e saldo esperado    |
| Dinheiro/cartão recebido pela loja | Venda, sem recebível iFood    |
| Comissão sobre recebimento da loja | Evento reduz saldo            |
| Benefício iFood                    | Separado da cesta             |
| Duas formas                        | Dois registros e soma correta |
| Três parcelas                      | Valores e datas preservados   |
| Método desconhecido                | Código preservado e revisão   |
| Cancelamento posterior             | Mesmo pedido, evento e alerta |

Aceite monetário: diferença máxima R$ 0,01 por venda/fechamento.

## Resume and isolation

1. Falhe a segunda página; confirme execução parcial.
2. Retome; confirme ausência de duplicidade.
3. Sincronize dois tenants/merchants; confirme isolamento.
4. Execute ingestão operacional e financeira simultânea; confirme um pedido.

## Homologation

1. Use teste e indicador exigido pelo iFood.
2. Demonstre Sales paginada.
3. Demonstre eventos com/sem impacto.
4. Demonstre fechamento e datas esperada/real.
5. Demonstre 401, 403, 429 e retomada.
6. Demonstre bruto, comissão, líquido, recebedor e atualização.
7. Solicite o arquivo mensal, acompanhe o processamento, baixe-o quando pronto e demonstre reutilização da solicitação dentro de seis horas.
8. Registre apenas evidência não sensível.
9. Marque produção pronta somente após aprovação formal.

## Exit criteria

- 100% do período classificado.
- Zero duplicidade na repetição.
- Pedido operacional preservado.
- Histórico sinalizado como consolidado.
- Tolerância financeira respeitada.
- Recebimento da loja fora do recebível iFood.
- Nenhum segredo exposto.
- Regressões aprovadas.
- Produção bloqueada sem homologação.
