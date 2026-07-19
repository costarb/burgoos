# Implementation Plan: Integracao de Vendas PagBank

**Branch**: `013-pagbank-sales-integration` | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-pagbank-sales-integration/spec.md`

## Summary

Adicionar uma integracao tenant-scoped para consultar o extrato transacional EDI v3.00 do PagBank por periodo, persistir uma pre-visualizacao auditavel e importar vendas validadas como pedidos historicos sem duplicidade. A solucao introduz um contrato comum de provider/canal, separa coleta e normalizacao da criacao de pedidos e refatora o importador CSV existente para compartilhar o mesmo pipeline normalizado. PagBank sera o primeiro adapter; outros providers poderao declarar capacidades e implementar sua propria coleta sem duplicar pre-visualizacao, idempotencia ou auditoria.

## Technical Context

**Language/Version**: TypeScript strict, Node.js 20+

**Primary Dependencies**: NestJS 10, Next.js 14 App Router, React 18, Prisma, PostgreSQL, class-validator, native `fetch`, Node.js `crypto`

**Storage**: PostgreSQL via Prisma para configuracao, credencial cifrada, execucoes, dias e movimentos externos; pedidos e itens existentes continuam como destino da importacao

**Testing**: Vitest para adapters, normalizacao, services e UI; Supertest para contratos HTTP e isolamento tenant; fixtures JSON derivadas dos cenarios oficiais PagBank; typecheck, lint e Prisma validation

**Target Platform**: Aplicacao web administrativa e API Node.js em Linux/containers; navegador desktop/mobile para administracao

**Project Type**: Monorepo web com API REST, frontend administrativo e pacotes compartilhados

**Performance Goals**: Pre-visualizar ate 31 dias e 31.000 movimentos em uma execucao; percorrer paginas de ate 1.000 registros; apresentar progresso/resultado sem bloquear a requisicao HTTP; consultas de historico paginadas

**Constraints**: EDI consulta uma data por vez, dados confiaveis apenas quando `VALIDADO=true`, sem sandbox, token EDI distinto do token comum, limite de 1.000 itens por pagina, credenciais nunca retornadas, D-1, idempotencia entre API e CSV e isolamento tenant obrigatorio

**Scale/Scope**: Dezenas a centenas de lojas; uma integracao PagBank ativa por tenant; execucoes manuais de ate 31 dias na primeira versao; apenas movimentos `transactional`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

- **Real Operation First**: Pass. Substitui trabalho manual de CSV em uma operacao financeira real e mantem o escopo em consulta/importacao manual PagBank.
- **TypeScript Strict By Default**: Pass. DTOs, adapter, resposta EDI, venda normalizada e contratos frontend/backend serao explicitamente tipados e validados.
- **Modular Monolith, Domain-Oriented**: Pass. A feature fica em `Management/Sales Integrations`, reutiliza `Ordering` por contrato interno e nao cria servico separado.
- **Tenant Isolation Is A Design Constraint**: Pass. Todas as entidades persistidas carregam `tenantId`; controllers derivam tenant do JWT; indices e testes cobrem acesso cruzado.
- **Tests Protect Operational Flow**: Pass. Fixtures oficiais cobrem mapeamento sem token; testes de API cobrem D-1, `VALIDADO`, paginacao, idempotencia, rollback por venda e isolamento tenant.
- **MVP Scope Promotion**: Pass with explicit feature promotion. Integracao financeira era pos-MVP, mas esta especificacao a promove com limites claros: PagBank, operacao manual, transacional e sem conciliacao de cancelamentos/liquidacoes.
- **Pre-implementation artifacts**: Pass. Spec, plan, research, data model, API contracts and dependency-ordered `tasks.md` are present.
- **Post-design re-check**: Pass. O desenho permanece dentro do monolito, explicita contratos e tenant ownership e nao introduz violacao sem justificativa.

## Project Structure

### Documentation (this feature)

```text
specs/013-pagbank-sales-integration/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- sales-integrations.openapi.yaml
|-- checklists/
|   `-- requirements.md
`-- tasks.md
```

### Source Code (repository root)

```text
apps/
|-- api/
|   |-- src/
|   |   |-- management/sales-integrations/
|   |   |   |-- dto/
|   |   |   |-- pagbank/
|   |   |   |-- sales-integration.controller.ts
|   |   |   |-- sales-integration.service.ts
|   |   |   |-- sales-import-orchestrator.service.ts
|   |   |   |-- sales-provider.adapter.ts
|   |   |   `-- sales-provider.registry.ts
|   |   |-- ordering/
|   |   |   `-- historical-order-import.service.ts
|   |   `-- security/
|   |       `-- integration-secret.service.ts
|   `-- test/
|       `-- sales-integration.e2e.spec.ts
`-- web/
    `-- app/admin/orders/import/
        |-- order-import-client.tsx
        `-- sales-integration-client.tsx
packages/
|-- database/prisma/
|   |-- schema.prisma
|   `-- migrations/
`-- types/src/
    `-- sales-integrations.ts
```

**Structure Decision**: Criar um subdominio `management/sales-integrations` separado de delivery, porque esta integracao traz historico financeiro e nao opera o ciclo de vida de pedidos de marketplace. O frontend amplia a area existente de importacao de pedidos. `Ordering` expoe uma operacao interna que aceita venda normalizada; CSV e adapters externos tornam-se canais de entrada para o mesmo pipeline. A cifra de segredos e extraida para um servico reutilizavel, preservando compatibilidade com credenciais de delivery.

## Design Decisions

- `SalesProviderAdapter` declara provider, canal, capacidades, configuracao exigida e `fetchDay`; o registry resolve o adapter sem condicionais espalhadas.
- `PagBankEdiAdapter` usa EDI v3.00 `transactional`, consulta uma data por vez, envia USER/TOKEN no formato exigido pelo contrato confirmado durante implementacao, percorre `pagination.totalPages` e devolve integralidade a partir do header `VALIDADO`.
- A pre-visualizacao cria uma execucao persistida e movimentos imutaveis. A confirmacao recebe apenas o `runId`, evitando confiar em payload de venda enviado pelo navegador ou consultar novamente dados que podem mudar.
- Execucoes sao processadas assincronamente pelo worker interno ja usado pelo monolito; polling HTTP informa estado e contagens. Nao sera adicionado broker nesta fase.
- `ExternalSalesMovement` conserva payload original redigido e resumo normalizado para auditoria/testes, mas nunca credenciais ou headers de autenticacao.
- `ExternalSaleIdentity` (representada pelo movimento importado) possui unicidade `(tenantId, provider, externalSaleId)` e referencia opcional ao pedido. O pedido mantem `externalPaymentId`; a restricao nova fecha a corrida que o indice nao-unico atual permite.
- A deduplicacao CSV/API usa o mesmo `externalSaleId`. Sem identificador identico, o sistema rejeita para revisao; nao aplica heuristica por data/valor.
- Cada venda e criada em transacao propria com pedido, itens, vinculo externo e snapshot de rentabilidade. Uma falha nao reverte vendas anteriores nem deixa a venda atual parcial.
- Periodos sao inclusivos e limitados a 31 dias na primeira versao. Dia atual/futuro e dia sem `VALIDADO=true` ficam bloqueados; dias completos do mesmo run podem ser importados.
- Cancelamentos, chargebacks e ajustes sao persistidos/classificados como `NON_SALE` e nao alteram pedido nesta versao.

## Complexity Tracking

No constitution violations requiring exception.
