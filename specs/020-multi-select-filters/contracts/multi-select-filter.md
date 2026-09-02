# UI Contract: MultiSelectFilter

## Inputs

- `label`: nome acessível obrigatório.
- `options`: lista de valor/rótulo e disponibilidade.
- `value`: lista controlada de valores selecionados.
- `onChange(nextValues)`: notificação de seleção, remoção ou limpeza.
- `placeholder`, `allLabel`, `emptyMessage`, `disabled`: personalização opcional.

## Interaction

- O acionador alterna o painel e informa `aria-expanded`.
- Cada opção é um checkbox rotulado.
- Escape fecha e devolve foco; clique externo fecha.
- Limpar produz `[]`.
- “Selecionar todos” produz todos os valores habilitados; quando todos estão marcados, a mesma ação produz `[]`.
- Alterações não disparam consulta por conta própria.
