# Quickstart: validação manual

1. Abra `admin/orders` com pelo menos 5-6 pedidos ativos distribuídos entre Novo, Preparando, Pronto e Saiu (misture um pedido iFood pendente de aceite, se possível).
2. Sem clicar em nada, pressione `Tab` e confirme que o pedido mais antigo de toda a fila é selecionado, com anel azul visível, selo de posição ("1/N") e a barra fixa de atalhos mostrando o mesmo pedido.
3. Pressione `Tab` repetidamente e confirme que a seleção avança pedido a pedido, cruzando colunas na ordem cronológica; `Shift+Tab` deve voltar.
4. Pressione `1`, `2`, `3` e `4` e confirme que a seleção pula para o primeiro pedido de cada coluna (sem efeito nas colunas vazias).
5. Com um pedido normal selecionado, pressione `F2` e confirme que ele avança de fase (mesmo resultado do botão) e que a seleção passa automaticamente para o próximo pedido mais antigo.
6. Selecione um pedido iFood pendente e pressione `F2`; confirme que ele é aceito (mesmo efeito do botão "Aceitar iFood").
7. Selecione um pedido normal, pressione `F3` uma vez e confirme o aviso de confirmação; espere mais de 2 segundos e confirme que o aviso some sem cancelar o pedido.
8. Repita o passo 7, mas pressione `F3` de novo dentro de 2 segundos; confirme que o pedido é cancelado (mesmo efeito do botão "Cancelado").
9. Selecione um pedido iFood pendente, pressione `F3` duas vezes; confirme que o formulário de motivo de recusa abre (sem recusar sozinho) e que digitar nele não dispara nenhum atalho.
10. Com o formulário de recusa aberto, confirme que `F2`/`F3`/`F4`/`1`-`4` não têm efeito nenhum sobre a fila enquanto o campo está com foco.
11. Selecione um pedido elegível para cobrança (sem comanda) e pressione `F4`; confirme que o diálogo de cobrança abre. Repita num pedido vinculado a comanda e confirme que `F4` não faz nada.
12. Com o diálogo de Manutenção ou Cobrança aberto, pressione `F2`/`F3`/`Tab` e confirme que nada acontece na fila por trás do modal.
13. Com um pedido selecionado, force uma atualização em tempo real que remova esse pedido da fila (ex. avance/cancele o mesmo pedido em outra aba); confirme que a seleção se move automaticamente para outro pedido válido, sem travar.
14. Pressione `Esc` a qualquer momento e confirme que a seleção é limpa (nenhum card destacado) e qualquer confirmação de `F3` pendente é cancelada.
15. Confirme que todos os botões existentes (clique do mouse) continuam funcionando normalmente, sem nenhuma mudança de comportamento.
