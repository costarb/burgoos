# Data Model: Indicador de Carregamento na Navegação

Não há alteração de esquema de banco de dados nem de contrato de API. Os modelos abaixo existem apenas como estado de UI (React), compartilhado entre `/admin` e `/platform` via `AdminShell`.

## NavigationProgressState (novo, estado de UI)

- `status`: `"idle" | "pending" | "visible"`.
  - `idle`: nenhuma navegação em andamento.
  - `pending`: navegação iniciada (clique detectado), mas ainda dentro da janela de 150ms — barra ainda não é exibida (evita flash, FR-004).
  - `visible`: barra exibida; permanece neste estado por no mínimo 200ms mesmo que a navegação já tenha terminado.
- `startedAt`: timestamp do clique que iniciou a navegação, usado para calcular os limiares de exibição/permanência mínima.
- Transições:
  - `idle -> pending`: clique detectado num link interno do menu.
  - `pending -> visible`: 150ms se passam sem a navegação ter concluído.
  - `pending -> idle`: navegação conclui antes dos 150ms (nunca chega a aparecer).
  - `visible -> idle`: navegação concluiu (pathname/searchParams mudaram) E já se passaram pelo menos 200ms desde que ficou `visible`; ou o tempo-limite de segurança (15s) foi atingido.

## RouteSkeletonVariant (novo, apenas apresentação)

- `"list"`: usado em telas de listagem/tabela (ex.: pedidos, contas a pagar, catálogo) — blocos de cabeçalho + linhas repetidas.
- `"panel"`: usado em telas de painel/relatório com cartões de métricas (ex.: relatório de vendas, DRE, fluxo de caixa) — blocos de cartão + área de gráfico/tabela.
- Cada arquivo `loading.tsx` de rota escolhe a variação mais próxima da tela real; nenhuma variação tenta reproduzir fielmente o layout final (ver Assumptions do spec.md).

## Validation / Regras de consistência

- Apenas um `NavigationProgressState` existe por vez (estado global único em `AdminShell`); uma nova navegação iniciada antes da anterior terminar reinicia `startedAt` e mantém o status já alcançado (não regride de `visible` para `pending`), atendendo FR-009.
- O estado nunca permanece em `visible` além do tempo-limite de segurança de 15s, independentemente de `pathname`/`searchParams` mudarem ou não (FR-008).
- `loading.tsx` de cada rota é independente do `NavigationProgressState` — os dois mecanismos (barra global + esqueleto por rota) funcionam em paralelo e não compartilham estado entre si; a barra é sempre visível durante a navegação, o esqueleto aparece apenas se aquele segmento específico realmente suspender.
