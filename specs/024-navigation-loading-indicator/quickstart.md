# Quickstart: validação manual

1. Abra o admin e identifique uma tela com carregamento perceptível (ex.: relatório de vendas com bastante dado, ou throttle a rede no devtools para ~"Fast 3G").
2. Clique num item do menu lateral que leve a essa tela e confirme que uma barra fina aparece no topo em até ~150ms, na cor de marca (índigo), e permanece se movendo continuamente enquanto a tela carrega.
3. Confirme que, enquanto a barra está visível, a área de conteúdo mostra um esqueleto (blocos/linhas) em vez de ficar em branco.
4. Confirme que, quando os dados chegam, o esqueleto é substituído pelo conteúdo real sem um salto brusco de layout, e a barra desaparece.
5. Clique num item do menu que leve a uma tela já carregada rapidamente (sem throttle) e confirme que a barra não chega a aparecer de forma perceptível (sem flash).
6. Com uma navegação lenta em andamento (barra visível), clique em outro item do menu antes da primeira terminar; confirme que a barra continua visível de forma consistente (sem piscar) e reflete a navegação mais recente.
7. Force um erro de navegação (ex.: desligar a rede momentaneamente ou navegar para uma rota que retorne erro) e confirme que a barra desaparece e o erro é comunicado normalmente, sem a barra ficar travada.
8. Repita os passos 2-5 na seção `/platform` (não só `/admin`) e confirme o mesmo comportamento.
9. Compare visualmente a cor da barra com os botões primários e a navegação ativa do menu, confirmando que é a mesma linguagem de marca.
10. Ative "reduzir movimento" nas preferências do sistema operacional/navegador e confirme que a barra ainda comunica progresso (de forma mais estática), sem quebrar a experiência.
