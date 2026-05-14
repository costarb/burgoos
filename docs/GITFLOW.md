# Gitflow

Este repositório usa um Gitflow simples para separar produção, integração e trabalho de feature.

## Branches principais

### `main`

Branch estável de produção. Só recebe merges vindos de `release/*` ou `hotfix/*`.

Regras:

*   Deve estar sempre em estado publicável.
*   Commits diretos devem ser evitados.
*   Tags de versão devem sair daqui.

### `develop`

Branch de integração. Recebe features aprovadas e serve como base para novas branches de trabalho.

Regras:

*   Novas features devem nascer a partir de `develop`.
*   Pull requests de feature devem mirar `develop`.
*   Deve permanecer executável, mesmo que ainda não esteja pronta para produção.

## Branches temporárias

### `feature/*` ou `NNN-nome-da-feature`

Usada para novas funcionalidades e specs do Spec Kit.

Exemplos:

```text
001-validacao-delivery-real
feature/cardapio-publico
feature/painel-pedidos
```

Fluxo:

```text
develop -> feature/* -> develop
```

### `release/*`

Usada para estabilizar uma versão antes de produção.

Fluxo:

```text
develop -> release/x.y.z -> main
                         -> develop
```

### `hotfix/*`

Usada para correções urgentes em produção.

Fluxo:

```text
main -> hotfix/x.y.z -> main
                    -> develop
```

## Convenção de commits

Use Conventional Commits:

```text
feat: add public menu checkout
fix: reject inactive products during checkout
docs: initialize delivery pilot spec
chore: configure workspace tooling
test: cover order total calculation
```

## Fluxo recomendado com Spec Kit

1. Atualize `develop`.
2. Crie uma feature com o Spec Kit.
3. Preencha `spec.md`, `plan.md` e `tasks.md`.
4. Implemente seguindo `tasks.md`.
5. Abra PR da feature para `develop`.
6. Quando `develop` estiver pronto para uma versão, crie `release/*`.
7. Faça merge da release em `main` e tagueie a versão.

## Regras práticas

*   Não trabalhar direto em `main`.
*   Evitar trabalhar direto em `develop`, exceto ajustes pequenos de configuração.
*   Cada PR deve explicar quais user stories/tarefas do Spec Kit foram atendidas.
*   Antes de mergear, executar pelo menos lint, typecheck e testes disponíveis.
