# Research: Paginação no Grid de Contas a Pagar

## Contexto investigado

- **Backend**: `AccountsPayableService.list` (`apps/api/src/management/financial/accounts-payable/accounts-payable.service.ts`) já implementa paginação real:
  - `page` (padrão 1) e `pageSize` (padrão 50, validado no DTO com `@Min(1)`/`@Max(100)`) controlam `skip`/`take` da consulta Prisma.
  - Quando há filtro de `status`, a paginação é feita via `queryStatusPageIds` (SQL bruto com `OFFSET`/`LIMIT`), porque o status é calculado (não é uma coluna persistida) — a página final ainda respeita `page`/`pageSize` corretamente.
  - A resposta já inclui `page`, `pageSize` e `total` (contagem de registros que atendem à consulta, calculada em `querySummary` via `COUNT(*)`).
  - O resumo financeiro (`summary`) já é calculado sobre o conjunto completo filtrado, não sobre a página — não precisa de alteração.
  - Conclusão: **nenhuma mudança de backend é necessária** para os requisitos da spec; o contrato já existe e está coberto por `PayablesQueryDto`.

- **Frontend**: `PayablesClient` (`apps/web/app/admin/finance/payables/payables-client.tsx`) e `getPayables` (`apps/web/lib/api.ts`):
  - `PayablesFilters` (tipo compartilhado) já tem `page?`/`pageSize?`, mas `emptyFilters` e todo o fluxo de `refresh`/`applyFilters`/`clearFilters` nunca definem esses campos — logo cada chamada usa o padrão do backend (página 1, 50 registros) e não há forma de o usuário navegar além disso.
  - Não existe estado de página nem componente de navegação nesta tela.
  - **Causa raiz confirmada**: a consulta nunca é "incompleta" no backend; é a tela que só solicita e exibe a primeira página, sem oferecer meio de ver o restante.

## Padrão de referência já existente no repositório

- `apps/web/app/admin/reports/sales/sales-report-client.tsx` já implementa paginação (`page`, `pageSize`, `total`, `PageLink`, cálculo de página anterior/próxima e total de páginas), mas em uma arquitetura orientada a `searchParams` de URL (Server Component recarrega a página inteira ao navegar).
- `PayablesClient` é um Client Component que mantém filtros em estado local e já tem um padrão de "aplicar" via `refresh(nextFilters)` sem navegação de URL (ver `applyFilters`/`clearFilters`). Reproduzir a paginação via estado local (não via URL) mantém consistência com o padrão já usado nesta tela e evita reescrever `page.tsx` como Server Component orientado a `searchParams`.
- Decisão: implementar a paginação da tela de Contas a Pagar como **estado local de página no `PayablesClient`**, reaproveitando `refresh()` para buscar a página desejada, e exibir texto "Página X de Y" + botões anterior/próxima — replicando a semântica de `sales-report-client.tsx` (mesmo texto/cálculo de páginas), mas com disparo por clique local (`onClick`) em vez de `<a href>`.

## Decisões

- **Decision**: Não alterar o backend (`AccountsPayableService`, `PayablesQueryDto`, controller) — o contrato de paginação já atende à spec.
  - **Rationale**: código e testes existentes já cobrem `page`/`pageSize`/`total`; qualquer mudança seria puramente de exposição no frontend.
  - **Alternatives considered**: aumentar `pageSize` máximo ou mudar o padrão de 50 — rejeitado por não ser necessário para resolver o problema relatado (o usuário só precisa conseguir navegar, não de páginas maiores) e por manter o desempenho da consulta previsível.

- **Decision**: Guardar `page` no estado de `PayablesClient` (junto de `filters`), resetando para `1` sempre que `applyFilters`/`clearFilters` forem acionados.
  - **Rationale**: replica o padrão já usado pela própria tela (estado local controlado), sem introduzir roteamento por URL nesta tela.
  - **Alternatives considered**: mover para `searchParams`/Server Component como em `sales-report-client.tsx` — rejeitado por exigir reescrever `page.tsx` e o fluxo de refresh existente, aumentando o escopo sem necessidade.

- **Decision**: Exibir navegação com botões "Página anterior" / "Próxima página" + texto "Página X de Y" (Y = `Math.max(1, Math.ceil(total / pageSize))`), desabilitando os botões nos limites — mesmo cálculo usado em `sales-report-client.tsx`.
  - **Rationale**: consistência visual/comportamental com uma tela já existente e validada pelos usuários.
  - **Alternatives considered**: paginação numerada (1,2,3…) ou "carregar mais" — rejeitadas por não haver precedente no admin e por aumentar a complexidade sem necessidade explícita na spec (ver Assumptions do spec.md).

- **Decision**: Se a página atual ficar fora do intervalo válido após uma nova consulta (ex.: total de páginas diminuiu porque um filtro foi trocado, ou dados mudaram), ajustar automaticamente para a última página válida (ou `1` se não houver registros) antes de exibir o resultado.
  - **Rationale**: atende à FR-006 e ao edge case de "página que deixa de existir", evitando grid vazio por erro de intervalo.
  - **Alternatives considered**: mostrar erro e exigir ação manual do usuário — rejeitada por ser pior experiência para um caso que o sistema pode resolver sozinho.

**Output**: todas as dúvidas técnicas resolvidas; nenhum item `NEEDS CLARIFICATION` restante.
