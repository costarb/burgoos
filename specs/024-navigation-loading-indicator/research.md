# Research: Indicador de Carregamento na Navegação

## Contexto investigado

- **Onde montar um indicador global**: `app/admin/layout.tsx` e `app/platform/layout.tsx` (30 + 4 = 34 páginas) usam exatamente o mesmo componente `AdminShell` ([admin-shell.tsx](../../apps/web/components/admin/admin-shell.tsx)), que já renderiza o menu lateral (`<Link>` do Next.js) usado em ambas as seções. Montar o indicador **dentro do `AdminShell`** cobre as duas seções automaticamente, sem duplicar código nem editar layout por layout — atende FR-010 ("todas as telas acessíveis pelo menu principal") de forma robusta.
- **Sem `loading.tsx` hoje**: nenhuma das 34 páginas tem um arquivo `loading.tsx` (convenção nativa do Next.js App Router para UI de carregamento por segmento, baseada em `React.Suspense`). Todas usam `export const dynamic = "force-dynamic"` em Server Components, então a troca de tela realmente fica sem qualquer feedback intermediário.
- **Versão do Next.js**: `next@^14.2.0` ([apps/web/package.json](../../apps/web/package.json)). Isso importa porque o App Router do Next 14 **não expõe eventos de navegação** (diferente do antigo Pages Router, que tinha `Router.events`) nem o hook `useLinkStatus` (introduzido só no Next 15.3+) — qualquer indicador de progresso precisa ser construído com as ferramentas disponíveis no Next 14: `usePathname()`, `useSearchParams()` e listeners de clique.
- **Menu principal vs. links secundários**: o menu lateral do `AdminShell` usa exclusivamente `next/link` (`<Link>`), garantindo navegação client-side. Já foram vistos links secundários dentro de telas (ex.: "Importar histórico", "Consultar vendas") implementados como `<a href>` puro (navegação de página inteira). Cobrir esses links secundários exigiria trocá-los por `<Link>` — fora do escopo desta spec, que fala especificamente do "menu principal" (FR-010).
- **Linguagem visual existente**: [operation-feedback.tsx](../../apps/web/components/admin/operation-feedback.tsx) usa uma cor **azul-céu** (`sky`) para o estado "pending" — mas é um padrão de UI diferente (um banner com borda e texto), não comparável 1:1 a uma barra fina de progresso no topo da tela. O acento de marca predominante em botões, navegação ativa e no próprio símbolo do `AdminShell` é o token `tomato` (agora o índigo `#5B3DF6` da identidade RRFive OS recém-aplicada).

## Decisões

- **Decision**: Implementar o indicador de navegação como um componente cliente único (`NavigationProgressBar`), montado uma vez dentro de `AdminShell`, sem biblioteca externa.
  - **Rationale**: cobre `/admin` e `/platform` de uma vez (34 páginas); evita dependência nova para uma necessidade pequena e bem definida; mantém controle total sobre os limiares de tempo exigidos pelas FR-004/FR-003.
  - **Alternatives considered**: bibliotecas prontas (`nextjs-toploader`, `next-nprogress-bar`) — rejeitadas porque adicionam uma dependência para um comportamento que dá para implementar em poucas linhas, e porque o projeto já demonstra preferência por soluções enxutas (ver Constitution, "Real Operation First").

- **Decision**: Detectar início de navegação por meio de um listener de clique (delegado em `document`) em links internos do menu, e detectar o fim da navegação observando mudanças em `usePathname()`/`useSearchParams()` via `useEffect`.
  - **Rationale**: é o padrão conhecido para simular "início/fim de navegação" no App Router do Next 14, que não expõe esses eventos nativamente; `usePathname`/`useSearchParams` só mudam de valor depois que a nova rota realmente é aplicada, garantindo que o "fim" seja preciso.
  - **Alternatives considered**: migrar todas as navegações para `router.push` dentro de `startTransition` (o `isPending` do `useTransition` refletiria a navegação) — rejeitado por exigir reescrever todo o menu lateral e qualquer navegação programática existente, aumentando o escopo sem necessidade.

- **Decision**: Aplicar dois limiares de tempo — a barra só aparece se a navegação ainda estiver em andamento após **150ms** do clique (evita flash em navegações rápidas, FR-004/SC-003), e, uma vez visível, permanece por no mínimo **200ms** antes de poder desaparecer (evita um "pisca" caso a navegação termine bem depois do limiar de exibição).
  - **Rationale**: valores padrão de mercado para indicadores desse tipo (ex.: NProgress, barra do GitHub), equilibram "feedback imediato" (FR-001, até 100ms percebido) com "sem ruído visual" em trocas de tela já rápidas hoje.
  - **Alternatives considered**: mostrar a barra imediatamente ao clique, sem atraso — rejeitado por FR-004 pedir explicitamente que não haja flash perceptível em navegações muito rápidas.

- **Decision**: Incluir um tempo-limite de segurança (ex.: 15s) que força o indicador a desaparecer mesmo se `usePathname`/`useSearchParams` nunca mudarem (ex.: navegação para a mesma URL, erro silencioso).
  - **Rationale**: atende ao edge case "indicador não pode ficar travado indefinidamente" (FR-008) mesmo em cenários não cobertos pelo tratamento de erro padrão do Next.js.
  - **Alternatives considered**: nenhum tempo-limite — rejeitado por deixar uma via de indicador "preso" sem saída caso o pathname não mude.

- **Decision**: A cor do indicador usa o token de marca `tomato` (índigo primário), não a cor `sky` do `OperationFeedback`.
  - **Rationale**: FR-007 pede alinhamento de "linguagem visual" com os indicadores existentes — interpretado como usar o mesmo acento de marca já dominante em botões, navegação ativa e no símbolo do `AdminShell`, e não replicar pixel-a-pixel um componente de padrão diferente (banner de mensagem vs. barra de progresso). Resultado: consistência de marca em vez de imitação literal de um componente não comparável.
  - **Alternatives considered**: reaproveitar a cor `sky` do `OperationFeedback` — rejeitado por ser a cor de um padrão de UI diferente (banner com texto), sem relação direta com a nova barra fina de topo.

- **Decision**: Para a prévia esquemática (US2), usar a convenção nativa `app/**/loading.tsx` do Next.js App Router (baseada em `React.Suspense`), apoiada por **um componente de esqueleto genérico compartilhado** com 2 variações simples (lista/tabela e painel/relatório), em vez de um esqueleto bespoke por tela.
  - **Rationale**: `loading.tsx` é a ferramenta nativa do framework para exatamente este problema — Next.js já sabe mostrá-lo assim que a navegação começa, sem nenhum código de detecção adicional; o esqueleto genérico atende à Assumption do spec.md de que "não precisa replicar fielmente o layout final de cada tela".
  - **Alternatives considered**: esqueleto customizado por tela — rejeitado nesta primeira versão por aumentar muito o escopo (34 páginas) sem ganho proporcional; fica como possível refinamento futuro por tela de alto tráfego.

- **Decision**: Não converter os links secundários em `<a href>` (ex.: "Importar histórico") para `next/link` nesta feature.
  - **Rationale**: FR-010 fala do "menu principal"; esses links já disparam uma navegação de página inteira, cujo próprio navegador já fornece algum feedback nativo (spinner da aba); converter esses pontos é uma limpeza maior e separada, fora do escopo combinado.
  - **Alternatives considered**: converter tudo para `<Link>` nesta mesma feature — rejeitado por ampliar o escopo além do que foi pedido e testado.

**Output**: todas as dúvidas técnicas resolvidas; nenhum item `NEEDS CLARIFICATION` restante.
