# Implementation Plan: Cardapio por dominio da loja

**Branch**: `015-custom-domain-menu` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-custom-domain-menu/spec.md`

## Summary

Adicionar um dominio publico canonico e exclusivo ao cadastro da loja e disponibilizar a rota fixa `/cardapio`. O frontend extrai o host original da requisicao, consulta a API para resolver uma loja ativa e reutiliza o cardapio, ativos e checkout existentes por slug. As rotas legadas continuam ativas durante a transicao, enquanto confirmacoes iniciadas pelo dominio permanecem sob `/cardapio`.

## Technical Context

**Language/Version**: TypeScript, Node.js 20+

**Primary Dependencies**: NestJS, Next.js App Router, Prisma, PostgreSQL, TailwindCSS, class-validator

**Storage**: PostgreSQL; nova coluna opcional e unica em `Tenant` para o dominio canonico

**Testing**: Vitest para servicos e componentes, Supertest para contratos HTTP, typecheck e lint dos workspaces

**Target Platform**: Aplicacao web responsiva e API executadas em ambiente Linux atras de proxy confiavel

**Project Type**: Monorepo web com API, frontend e contratos TypeScript compartilhados

**Performance Goals**: Cardapio resolvido e visivel em ate 2 segundos em condicoes normais; alteracoes de dominio refletidas em ate 60 segundos

**Constraints**: Isolamento estrito entre lojas; host nao confiavel deve resultar em nao encontrado; preservar URLs legadas; nao automatizar DNS ou certificados

**Scale/Scope**: Dezenas a centenas de lojas, um dominio principal por loja nesta entrega

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Real Operation First**: Pass. Simplifica a URL divulgada pela loja piloto sem bloquear o fluxo existente.
- **TypeScript Strict By Default**: Pass. Dominio, contratos de loja e respostas publicas permanecem tipados e entradas sao validadas.
- **Modular Monolith, Domain-Oriented**: Pass. A mudanca cruza Platform/Stores, Catalog/Public Menu e a experiencia publica sem criar servico separado.
- **Tenant Isolation Is A Design Constraint**: Pass. Dominio unico resolve exatamente uma loja ativa; falhas nao usam loja padrao.
- **Tests Protect Operational Flow**: Pass. O plano cobre resolucao por dominio, conflito, inatividade, checkout e compatibilidade por slug.
- **Quality Gates**: Pass para planejamento. Spec, modelo de dados e contrato estao definidos; `tasks.md` sera gerado antes da implementacao.

## Project Structure

### Documentation (this feature)

```text
specs/015-custom-domain-menu/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- public-domain-menu.openapi.yaml
`-- tasks.md
```

### Source Code (repository root)

```text
apps/
|-- api/
|   |-- src/platform/stores/
|   |-- src/catalog/
|   |-- src/ordering/
|   `-- test/
|-- web/
|   |-- app/platform/stores/
|   |-- app/(public-menu)/[slug]/
|   |-- app/(public-menu)/cardapio/
|   `-- lib/api.ts
packages/
|-- database/prisma/
|   |-- schema.prisma
|   `-- migrations/
`-- types/src/index.ts
```

**Structure Decision**: Reaproveitar os modulos existentes de lojas, catalogo e pedidos. A resolucao por dominio e apenas uma nova forma publica de localizar o mesmo tenant; slug continua sendo a chave interna passada ao checkout e aos ativos.

## Design Decisions

1. `Tenant.publicDomain` armazena apenas o dominio canonico sem `www.`, em letras minusculas e com unicidade no banco.
2. A API expoe consulta publica por dominio e somente retorna loja ativa; nao existe fallback para primeiro tenant ou slug semelhante.
3. A pagina `/cardapio` le o host encaminhado pelo proxy, normaliza e consulta a API. Hosts de desenvolvimento podem ser informados explicitamente para teste, mas nao sao persistidos como dominio produtivo.
4. O endpoint por dominio devolve o mesmo contrato de `PublicMenu`; criacao do pedido continua usando o slug devolvido pela propria API.
5. O componente de cardapio recebe uma base de navegacao para redirecionar confirmacao e retorno tanto no modo legado quanto no modo por dominio.
6. A variacao `www.` e removida na normalizacao, fazendo `www.exemplo.com` e `exemplo.com` compartilharem a mesma chave de unicidade.
7. Respostas de resolucao por dominio usam revalidacao maxima de 30 segundos, sem fallback obsoleto entre dominios.

## Constitution Check - Post Design

- Nenhuma violacao identificada.
- O modelo possui chave unica e opcional, sem tabela ou servico prematuro.
- Os contratos preservam compatibilidade e tornam a resolucao multiempresa explicitamente testavel.
- A implementacao somente inicia depois da geracao de `tasks.md`.

## Complexity Tracking

No constitution violations.
