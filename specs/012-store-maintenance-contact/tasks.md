# Tasks: Manutencao de lojas e dados publicos

## Phase 1: Setup

- [x] T001 Confirmar contratos atuais de lojas em `packages/types/src/index.ts`

## Phase 2: Foundational

- [x] T002 Ampliar tipos compartilhados de endereco e links sociais em `packages/types/src/index.ts`
- [x] T003 Ampliar DTOs de loja em `apps/api/src/platform/stores/dto/store-onboarding.dto.ts`

## Phase 3: User Story 1 - Manter cadastro de lojas

- [x] T004 [US1] Adicionar filtros de consulta de lojas em `apps/api/src/platform/stores/platform-store.controller.ts`
- [x] T005 [US1] Implementar filtros e retorno ampliado em `apps/api/src/platform/stores/platform-store.service.ts`
- [x] T006 [US1] Evoluir listagem e criacao de lojas em `apps/web/app/platform/stores/page.tsx`

## Phase 4: User Story 2 - Registrar contato e presenca digital

- [x] T007 [US2] Persistir endereco e links sociais em `apps/api/src/platform/stores/platform-store.service.ts`
- [x] T008 [US2] Evoluir formulario de detalhe em `apps/web/app/platform/stores/[storeId]/page.tsx`
- [x] T009 [US2] Atualizar chamadas de API em `apps/web/lib/api.ts`

## Phase 5: User Story 3 - Exibir dados publicos no cardapio

- [x] T010 [US3] Expor dados publicos da loja no menu em `apps/api/src/catalog/catalog.service.ts`
- [x] T011 [US3] Renderizar contato e midias no footer em `apps/web/app/(public-menu)/[slug]/public-menu-client.tsx`

## Phase 6: Validation

- [x] T012 Rodar formatacao nos arquivos alterados
- [x] T013 Rodar typecheck dos workspaces API e web
- [x] T014 Validar status git e resumir entrega
