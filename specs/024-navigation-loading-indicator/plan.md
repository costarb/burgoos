# Implementation Plan: Indicador de Carregamento na Navegação

**Branch**: `024-navigation-loading-indicator` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/024-navigation-loading-indicator/spec.md`

## Summary

Hoje a troca de tela no painel administrativo (`/admin` e `/platform`, 34 páginas, todas atrás do mesmo `AdminShell`) não dá nenhum feedback visual entre o clique no menu e o conteúdo aparecer — não existe `loading.tsx` em nenhuma rota nem barra de progresso. A solução combina dois mecanismos nativos/leves: (1) uma barra de progresso fina no topo, montada uma única vez dentro de `AdminShell`, detectando início de navegação por clique nos links do menu e fim de navegação pela mudança de `usePathname()`/`useSearchParams()` (sem biblioteca nova, já que o Next 14 App Router não expõe eventos de navegação nativamente); (2) esqueletos de conteúdo via a convenção nativa `app/**/loading.tsx` do Next.js, apoiados por um componente de esqueleto genérico com duas variações (lista e painel). Limiares de tempo (150ms para aparecer, 200ms mínimo visível, 15s de segurança) evitam tanto o "flash" em navegações rápidas quanto um indicador travado indefinidamente.

## Technical Context

**Language/Version**: TypeScript, Node.js 20+

**Primary Dependencies**: React 18, Next.js 14.2 App Router, TailwindCSS (frontend apenas; nenhuma dependência nova)

**Storage**: N/A — nenhuma persistência nova; estado é local ao componente, em memória, por sessão de navegação

**Testing**: Vitest + `react-dom/client` (padrão "Harness" já usado nos hooks de `use-kds-orders`/`use-order-queue-shortcuts`); testes de temporização usam `vi.useFakeTimers()`

**Target Platform**: Navegadores desktop/mobile modernos; painel administrativo (`/admin` e `/platform`) em Next.js App Router

**Project Type**: Monorepo web — mudança restrita a `apps/web` (nenhuma mudança de API/DTO/schema)

**Performance Goals**: indicador percebido em até 100ms de atraso subjetivo (SC-001); nenhum impacto de performance mensurável na navegação em si — o mecanismo só observa mudanças de rota já existentes

**Constraints**: sem biblioteca nova (Next 14 não tem `useLinkStatus`/eventos de router nativos); cobre apenas navegação via `next/link` do menu lateral (não links `<a href>` secundários); respeitar `prefers-reduced-motion`; esqueletos podem ser genéricos, não pixel-perfect por tela

**Scale/Scope**: `AdminShell` (montagem única); `loading.tsx` na raiz de `/admin` e `/platform` (2 arquivos) cobre as 34 páginas por herança de Suspense boundary do Next.js — pastas com conteúdo bem diferente do genérico (ex.: relatórios com cartões de métrica) recebem um `loading.tsx` próprio adicional; um componente de esqueleto genérico com 2 variações

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Real Operation First**: Pass. Resolve um problema real relatado no uso diário do painel, sem expandir escopo além do menu principal.
- **TypeScript Strict By Default**: Pass. Estado de navegação e variações de esqueleto tipados explicitamente; nenhum `any`.
- **Modular Monolith, Domain-Oriented**: Pass. Mudança inteiramente em `apps/web` (UI compartilhada); nenhum domínio de negócio tocado.
- **Tenant Isolation Is A Design Constraint**: Pass. Não há acesso a dados; é puramente um indicador de UI sobre navegação já existente.
- **Tests Protect Operational Flow**: Pass. Temporização (aparecer/desaparecer/limite de segurança) e cobertura das 34 rotas com `loading.tsx` serão testadas.
- **Quality Gates**: Pass. `spec.md`, `plan.md` (este arquivo) e `tasks.md` (próxima etapa) serão explícitos antes da implementação.

## Project Structure

### Documentation (this feature)

```text
specs/024-navigation-loading-indicator/
├── spec.md
├── plan.md              # This file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── navigation-progress.md
├── checklists/requirements.md
└── tasks.md              # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
apps/web/components/admin/
├── admin-shell.tsx                    # monta o NavigationProgressBar uma vez
├── admin-shell.spec.tsx               # novos casos cobrindo a barra
├── navigation-progress-bar.tsx        # NOVO: componente cliente da barra
├── navigation-progress-bar.spec.tsx   # NOVO: testes de temporização/estado
├── route-skeleton.tsx                 # NOVO: esqueleto genérico (variações list/panel)
└── route-skeleton.spec.tsx            # NOVO: testes das variações

apps/web/app/admin/loading.tsx         # NOVO: fallback de todas as rotas sob /admin
apps/web/app/platform/loading.tsx      # NOVO: fallback de todas as rotas sob /platform
apps/web/app/admin/reports/loading.tsx # NOVO: override "panel" (relatórios têm mais cartões/gráfico)
apps/web/app/admin/finance/loading.tsx # NOVO: override "panel" (financeiro/fluxo de caixa)
```

Nenhum arquivo de `apps/api` ou `packages/types` é alterado — a feature é inteiramente de interação no cliente.

**Structure Decision**: montar a barra de progresso uma única vez dentro de `AdminShell` (compartilhado por `/admin` e `/platform`) em vez de duplicar em cada `layout.tsx`. Para os esqueletos, `loading.tsx` do Next.js aplica automaticamente ao segmento onde está E a todos os segmentos filhos que não tenham seu próprio `loading.tsx` (Suspense boundary por herança) — por isso dois arquivos na raiz de `/admin` e `/platform` já cobrem as 34 páginas; pastas cujo conteúdo real é visivelmente diferente do genérico "list" (relatórios e financeiro, com cartões de métrica) recebem um `loading.tsx` próprio com `variant="panel"`.

## Design

### `navigation-progress-bar.tsx`

- Componente cliente (`"use client"`), sem props — lê o estado global de navegação por meio de um pequeno hook interno (`useNavigationProgress`), que:
  - Registra um listener de clique delegado em `document`, filtrando apenas cliques em `<a>` internos (mesma origem, sem `target="_blank"`, sem tecla modificadora) dentro do menu lateral do `AdminShell`.
  - Usa `usePathname()` e `useSearchParams()` (do `next/navigation`) para detectar quando a navegação realmente concluiu.
  - Implementa a máquina de estados `idle -> pending -> visible -> idle` descrita em data-model.md, com os limiares de 150ms/200ms/15s via `setTimeout`.
- Renderiza uma `div` fixa no topo (`position: fixed; top: 0; height: 3px`) com `bg-tomato` (token de marca), visível apenas quando `status === "visible"`; anima com `@keyframes` já respeitando `prefers-reduced-motion`.

### `route-skeleton.tsx`

- Componente de apresentação puro, recebendo `variant: "list" | "panel"`.
- `list`: cabeçalho + N linhas repetidas simulando uma tabela/lista.
- `panel`: cartões de métrica + bloco de gráfico/tabela, simulando telas de relatório/painel.
- Usado nos arquivos `loading.tsx` de cada rota, escolhendo a variação mais próxima do layout real da tela.

### `loading.tsx` por rota

- `app/admin/loading.tsx` e `app/platform/loading.tsx` (raiz de cada seção) renderizam `<RouteSkeleton variant="list" />` — por herança de Suspense boundary do Next.js, isso já cobre qualquer página abaixo que não tenha seu próprio `loading.tsx` (as 34 páginas de ambas as seções):
  ```tsx
  import { RouteSkeleton } from "../../components/admin/route-skeleton";
  export default function Loading() {
    return <RouteSkeleton variant="list" />;
  }
  ```
- `app/admin/reports/loading.tsx` e `app/admin/finance/loading.tsx` sobrepõem o fallback da raiz com `<RouteSkeleton variant="panel" />`, por serem seções com cartões de métrica/gráfico — mais próximas visualmente dessa variação do que da lista genérica.
- Next.js já cuida de exibir o `loading.tsx` mais específico automaticamente via `React.Suspense` assim que a navegação para aquele segmento começa — nenhum código de detecção adicional é necessário aqui.

## Test Strategy

- **`navigation-progress-bar.spec.tsx`** (com `vi.useFakeTimers()`): não aparece antes de 150ms; aparece após 150ms se a navegação ainda não concluiu; não aparece se a navegação conclui antes de 150ms; permanece pelo menos 200ms uma vez visível; volta a `idle` após o tempo-limite de 15s mesmo sem mudança de rota; uma nova navegação iniciada com a barra já visível não regride para `pending`.
- **`admin-shell.spec.tsx`**: confirma que a barra está montada e reage a cliques nos links do menu tanto em `/admin` quanto em `/platform`.
- **`route-skeleton.spec.tsx`**: renderiza as duas variações sem erro, com os elementos esperados (blocos, linhas).
- **Regression**: suíte web existente, typecheck e lint. Verificação manual/build de que os 4 arquivos `loading.tsx` (raiz de `/admin`, raiz de `/platform`, `reports`, `finance`) cobrem as 34 páginas por herança, navegando por uma amostra representativa de rotas.

## Constitution Check - Post Design

Todos os gates permanecem aprovados. O desenho não introduz dependência nova nem toca em regra de negócio; usa a convenção nativa do Next.js sempre que possível (`loading.tsx`) e um componente enxuto e testável para o único mecanismo que exige código customizado (a barra de progresso).

## Complexity Tracking

Nenhuma violação constitucional identificada.
