# Quickstart: validação manual

1. Cadastre (ou use uma base com) mais de 50 contas a pagar para o tenant de teste, com vencimentos e status variados.
2. Abra a tela **Contas a pagar** sem aplicar filtros e confirme que o grid mostra apenas a primeira página (até o tamanho padrão), com indicação "Página 1 de N" e total de registros visível.
3. Clique em "Próxima página" e confirme que novos registros são carregados, os filtros continuam vazios e a indicação de página avança.
4. Chegue à última página e confirme que "Próxima página" fica desabilitada; volte com "Página anterior" até a primeira e confirme que ela fica desabilitada lá.
5. Na página 2 (ou posterior), aplique um filtro (ex.: um status) e confirme que o grid volta para a página 1 do novo resultado, com o total atualizado.
6. Aplique um filtro que resulte em zero registros e confirme o estado vazio já existente, sem navegação ativa.
7. Compare os cartões de resumo (Previsto, Pago, Em aberto, Vencido) entre páginas diferentes da mesma consulta e confirme que os valores não mudam (refletem o total da consulta, não da página).
8. Clique em "Detalhes"/"Editar" em um registro de uma página diferente da primeira e confirme que as ações continuam funcionando normalmente.
9. Solicite a exportação (CSV/PDF, conforme disponível) estando em uma página diferente da primeira e confirme que o arquivo gerado contém todos os registros da consulta, não apenas a página exibida.
10. Repita o fluxo em uma janela estreita (mobile) e confirme que os controles de paginação permanecem visíveis e utilizáveis.
