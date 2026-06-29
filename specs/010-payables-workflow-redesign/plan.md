# Implementation Plan: Repaginacao do Fluxo de Contas a Pagar

**Branch**: `010-payables-workflow-redesign` | **Date**: 2026-06-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-payables-workflow-redesign/spec.md`

## Summary

Repaginar a tela administrativa de contas a pagar para concentrar inclusao, consulta, detalhes e edicao em uma experiencia modal consistente, mantendo os cards Previsto, Pago, Em aberto e Vencido sempre visiveis. A implementacao aproveita a API e os tipos existentes de contas a pagar, desloca os formularios inline para dialogos reutilizaveis, adiciona exportacoes assincronas por CSV/PDF/XLSX com status persistido por tenant e cria um centro de notificacoes operacional para concluir ou sinalizar falhas desses trabalhos.

## Technical Context

**Language/Version**: TypeScript, Node.js 20+

**Primary Dependencies**: NestJS, Next.js App Router, Prisma, PostgreSQL, TailwindCSS, JWT com refresh token para administracao; geracao de arquivos CSV/PDF/XLSX usando bibliotecas Node maduras e tipadas escolhidas na implementacao

**Storage**: PostgreSQL via Prisma; contas a pagar ja usam `Payable`, `PayablePayment`, `FinancialCategory`, `Supplier` e `FinancialAudit`; a feature adiciona persistencia tenant-scoped para solicitacoes de exportacao, arquivos gerados/metadados e notificacoes operacionais

**Testing**: Vitest unit/integration tests para service/controller de contas a pagar, export jobs e notificacoes; testes React/Next para modais, cards, consulta, exportacao e centro de notificacoes; quickstart manual para validacao do fluxo completo

**Target Platform**: Aplicacao web administrativa responsiva e backend API/worker interno no monorepo existente

**Project Type**: Web app com backend API NestJS, frontend Next.js e processamento assicrono interno

**Performance Goals**: Tela de contas a pagar carrega e atualiza consulta em ate 2 segundos na base piloto; abrir modais de inclusao/edicao/detalhe em ate 500 ms apos dados locais disponiveis; solicitacao de exportacao retorna em ate 1 segundo; notificacao de conclusao/erro aparece em ate 30 segundos apos finalizacao do job em volume piloto

**Constraints**: Preservar isolamento por tenant; respeitar permissoes `finance.view` e `finance.manage`; exportacao deve usar snapshot dos filtros no momento da solicitacao; operacao de exportar nao pode bloquear a UI; arquivos gerados nao devem vazar dados entre tenants; nao alterar regras financeiras de pagamento, baixa, cancelamento, auditoria ou conciliacao

**Scale/Scope**: Tela administrativa de contas a pagar existente; dezenas a centenas de contas por mes no piloto; desenho permite reaproveitar notificacoes para outros processos administrativos e trocar armazenamento de arquivos local por S3-compativel quando necessario

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Real Operation First**: Pass. A repaginacao reduz friccao na rotina financeira real e promove exportacao/notificacao porque a spec exige esse fluxo operacional.
- **TypeScript Strict By Default**: Pass. Novos contratos de exportacao, notificacao, formatos, status e payloads serao tipados e validados nas fronteiras.
- **Modular Monolith, Domain-Oriented**: Pass. A mudanca permanece no dominio Management/Financial e adiciona um suporte operacional de notificacoes sem criar microservico.
- **Tenant Isolation Is A Design Constraint**: Pass. Contas, jobs de exportacao, arquivos e notificacoes carregam `tenantId` e resolvem acesso pelo usuario autenticado.
- **Tests Protect Operational Flow**: Pass. O plano exige testes para modais, indicadores, export jobs, notificacoes, permissoes e isolamento de tenant.

## Project Structure

### Documentation (this feature)

```text
specs/010-payables-workflow-redesign/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- openapi.yaml
|-- checklists/
|   `-- requirements.md
`-- tasks.md
```

### Source Code (repository root)

```text
apps/
|-- api/
|   |-- src/
|   |   |-- management/
|   |   |   |-- financial/
|   |   |   |   |-- dto/
|   |   |   |   |   |-- payable.dto.ts
|   |   |   |   |   `-- payable-export.dto.ts
|   |   |   |   `-- accounts-payable/
|   |   |   |       |-- accounts-payable.controller.ts
|   |   |   |       |-- accounts-payable.service.ts
|   |   |   |       |-- accounts-payable-export.service.ts
|   |   |   |       |-- accounts-payable-export.worker.ts
|   |   |   |       `-- accounts-payable.service.spec.ts
|   |   |   `-- notifications/
|   |   |       |-- notifications.controller.ts
|   |   |       |-- notifications.service.ts
|   |   |       `-- notifications.service.spec.ts
|   |   `-- test/
|   |       `-- accounts-payable-export.integration.spec.ts
|-- web/
|   |-- app/
|   |   `-- admin/
|   |       |-- finance/
|   |       |   `-- payables/
|   |       |       |-- page.tsx
|   |       |       |-- payables-client.tsx
|   |       |       |-- payable-form.tsx
|   |       |       |-- payable-detail-dialog.tsx
|   |       |       |-- payable-editor-dialog.tsx
|   |       |       `-- payables-client.spec.tsx
|   |       `-- notifications/
|   |           |-- page.tsx
|   |           `-- notifications-client.tsx
|   |-- components/
|   |   `-- admin/
|   |       |-- notification-center-button.tsx
|   |       `-- modal-shell.tsx
|   `-- lib/
|       `-- api.ts
packages/
|-- database/
|   `-- prisma/
|       |-- schema.prisma
|       `-- migrations/
`-- types/
    `-- src/
        |-- index.ts
        `-- notifications.ts
```

**Structure Decision**: Preservar a fatia financeira existente em `management/financial/accounts-payable` e `apps/web/app/admin/finance/payables`. Notificacoes entram como modulo administrativo compartilhavel, mas a primeira integracao concreta e com exportacoes de contas a pagar. Contratos compartilhados continuam em `packages/types`, e persistencia nova fica no Prisma do monorepo.

## Phase 0: Research

Research is captured in [research.md](./research.md). Main decisions:

- Reutilizar a lista/summary existente de contas a pagar como fonte dos cards, ajustando a apresentacao para manter indicadores sempre visiveis.
- Transformar inclusao e edicao em modais de fluxo controlado, reaproveitando `PayableForm` e o dialogo de detalhes.
- Criar export job persistido e processado em segundo plano dentro do monolito modular, com snapshot dos filtros.
- Criar notificacoes persistidas por tenant/usuario para sucesso, falha e acesso ao arquivo gerado.
- Expor CSV, PDF e XLSX como formatos de exportacao com contrato unico de solicitacao e acompanhamento.

## Phase 1: Design

Design outputs:

- Data model: [data-model.md](./data-model.md)
- API contract: [contracts/openapi.yaml](./contracts/openapi.yaml)
- Quickstart: [quickstart.md](./quickstart.md)

## Constitution Check - Post-Design

- **Real Operation First**: Pass. O design prioriza inclusao/consulta/edicao e exportacao usadas na rotina financeira, sem ampliar escopo para conciliacao ou baixa.
- **TypeScript Strict By Default**: Pass. O modelo define enums e contratos para formatos de exportacao, status de job e notificacoes.
- **Modular Monolith, Domain-Oriented**: Pass. Exportacao fica junto do dominio financeiro; notificacoes ficam como capacidade administrativa reutilizavel, ainda no mesmo deployable.
- **Tenant Isolation Is A Design Constraint**: Pass. Modelo e contratos exigem tenant e usuario autenticados para criar jobs, listar notificacoes e baixar arquivos.
- **Tests Protect Operational Flow**: Pass. Quickstart e contratos cobrem fluxo principal, falhas, permissoes e consistencia dos cards.

## Complexity Tracking

No constitution violations.
