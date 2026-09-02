# Research: Filtros com seleção múltipla

## Contrato de query

**Decision**: representar múltiplos valores repetindo `financialAccountId` na query.

**Rationale**: `URLSearchParams.append` e o parsing do Nest suportam naturalmente o formato; uma ocorrência preserva clientes antigos e evita delimitadores ambíguos.

**Alternatives considered**: CSV (ambíguo e exige escape); novo nome plural (quebra desnecessária de contrato); body em GET (baixo suporte).

## Comportamento de “todas”

**Decision**: conjunto vazio e todas selecionadas não restringem a consulta; a UI normaliza todas para vazio ao aplicar.

**Rationale**: mantém a convenção existente de ausência do parâmetro e produz URLs menores.

**Alternatives considered**: enviar todos os IDs; valor mágico `all`.

## Implementação visual

**Decision**: componente próprio com elementos HTML semânticos e sem nova biblioteca.

**Rationale**: o projeto não possui biblioteca de popover/command instalada; botão, painel e checkboxes atendem ao caso com custo e bundle menores.

**Alternatives considered**: `<select multiple>` (experiência ruim e não atende checkbox em combobox); adicionar Radix/Headless UI (dependência desnecessária para o escopo).

## Limite de rollout

**Decision**: nesta passagem, migrar os filtros de conta do Controle de Caixa e documentar os demais filtros elegíveis para adoção por contrato.

**Rationale**: selects de formulários têm semântica mutuamente exclusiva; filtros de outros domínios exigem alterações próprias de API, paginação e exportação e não devem ser convertidos mecanicamente.

**Alternatives considered**: substituir todo `<select>` do sistema (quebraria formulários); converter simultaneamente todos os filtros (aumenta risco e impede validar primeiro o fluxo solicitado).
