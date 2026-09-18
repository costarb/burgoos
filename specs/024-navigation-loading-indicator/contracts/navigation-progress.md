# UI Contract: Barra de progresso de navegação

Não é um contrato REST — é o comportamento esperado (e coberto por teste) do componente `NavigationProgressBar`, montado uma vez em `AdminShell` e válido para toda navegação feita pelo menu lateral (`/admin/**` e `/platform/**`).

## Timing

| Evento | Prazo | Efeito |
|---|---|---|
| Clique num link interno do menu | imediato | `status` vai de `idle` para `pending`; `startedAt` registrado |
| 150ms depois do clique, navegação ainda não concluiu | 150ms | `status` vai de `pending` para `visible`; barra aparece |
| Navegação conclui antes dos 150ms | < 150ms | `status` volta direto para `idle`; barra nunca aparece |
| Navegação conclui com a barra já `visible`, antes de completar 200ms visível | — | barra permanece até completar 200ms desde que ficou `visible`, depois vai para `idle` |
| Navegação conclui com a barra já `visible`, após 200ms | ≥ 200ms | `status` vai para `idle` imediatamente |
| Nenhuma navegação conclui | 15s | tempo-limite de segurança força `status` para `idle` |

## Detecção de conclusão

- "Navegação concluída" = `usePathname()` e/ou `useSearchParams()` mudaram de valor em relação ao momento do clique.
- Uma nova navegação iniciada com a barra já `visible` reinicia `startedAt`, mas não faz o `status` regredir para `pending` (a barra não some e reaparece nesse caso).

## Cor e estilo

- Usa o token de marca `tomato` (índigo primário da identidade RRFive OS) — mesmo acento usado em botões primários, navegação ativa e no símbolo do `AdminShell` (ver research.md, decisão de cor).
- Altura fina fixa no topo da viewport, sem interferir na leitura do conteúdo abaixo.
- Anima de forma contínua enquanto `visible` (nunca "trava" parada); respeita `prefers-reduced-motion` reduzindo a animação sem remover a indicação de progresso.

## Escopo

- Cobre exclusivamente navegações disparadas pelos links (`next/link`) do menu lateral do `AdminShell`, presente em todas as 34 páginas de `/admin/**` e `/platform/**`.
- Links secundários implementados como `<a href>` puro (navegação de página inteira) **não** disparam a barra — ficam com o indicador nativo do navegador (fora do escopo desta feature, ver research.md).
