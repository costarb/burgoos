# Tasks: Ações pelo MCP — Contas a Pagar e Importação de Vendas

**Input**: `/specs/028-mcp-write-actions/` (plan.md, spec.md, research.md, data-model.md, contracts/mcp-actions.md, quickstart.md)

**Tests**: incluídos (SC-001 a SC-003 exigem teste automatizado).

## Phase 1: Foundational

- [ ] T001 Schema: `StoreMcpConfiguration.actionsEnabled` (default false), `McpToolCall.isAction` (default false) + índice `(tenantId, connectionId, isAction, occurredAt)`, `FinancialAudit.channel` e `SalesImportRun.channel` (`VarChar(80)?`); migration `2026100410xxxx_mcp_write_actions` gerada por diff; `npm run db:generate`
- [ ] T002 [P] `apps/api/src/management/mcp/mcp-actions.ts`: `MCP_WRITE_SCOPE`, permissão e área por grupo de ação, limite por hora, `hasWriteScope(scope)`; testes
- [ ] T003 [P] `StoreEligibilityService.permissionsForStore(userId, tenantId)` (OWNER/ADMIN/master = todas; perfil da loja; usuário inativo ou sem acesso = nenhuma); testes
- [ ] T004 [P] Tipos em `packages/types`: `actionsEnabled` na configuração MCP, `scope`/"ações" nas conexões, `isAction` no uso, `channel` no histórico de importações

## Phase 2: User Story 1 - Habilitar ações com segurança (P1)

- [ ] T005 [US1] Configuração: `actionsEnabled` no DTO e em `store-mcp-configuration.service.ts`, auditado; resposta da configuração
- [ ] T006 [US1] OAuth: `scopes_supported` com `mcp:write`; autorização tolera `mcp:write`; consentimento recebe `allowActions` e grava `mcp:read mcp:write` só com loja permitindo e usuário com alguma permissão de ação; a tela recebe `actionsAvailable` e as ações liberadas; resolver devolve o escopo
- [ ] T007 [US1] Contexto: `McpRequestContext.actions { allowed, permissions, channel }` montado no `mcp-token.guard.ts` (token fixo = não permitido); `mcp-action-actor.ts` monta o `AuthUser` e o canal `MCP · <cliente>`
- [ ] T008 [US1] `McpToolDefinition` com `kind` e `permission`; `mcp-server.factory.ts` registra ações só quando permitidas, com anotações corretas, e ajusta as instruções do servidor; `mcp-tool-runner.ts` revalida na chamada (`ACTION_NOT_ALLOWED`), grava `isAction` e aplica o limite por conexão
- [ ] T009 [US1] `FinancialAuditService` e `SalesImportPreviewService.create` aceitam `channel` opcional (telas continuam nulas)
- [ ] T010 [P] [US1] Testes da matriz de autorização (SC-001) em `apps/api/test/mcp-actions-authorization.integration.spec.ts`: token fixo, sem escopo, loja sem ações, sem permissão, área desligada, revogada, limite; listagem e chamada direta; consentimento com/sem ações e cliente pedindo `mcp:write` sem a loja permitir
- [ ] T011 [US1] Web: chave "Permitir ações pelos assistentes" com explicação em `admin/settings/mcp`; conexões mostram "Leitura" ou "Leitura e ações"; uso destaca ações; consentimento em `conectar/mcp` com a opção desmarcada e a lista do que libera; testes

## Phase 3: User Story 2 - Contas a pagar (P1)

- [ ] T012 [US2] `tools/name-resolver.ts`: resolve categoria, fornecedor, conta financeira e produto por nome/id (normalizado, ambíguo = `INVALID_FILTER` com opções); `payables.tools.ts` passa a usá-lo e devolve `id` em `contas[]`
- [ ] T013 [US2] `tools/payables-actions.tools.ts`: `criar_conta_a_pagar` (com duplicidade e `confirmarDuplicidade`), `registrar_pagamento_conta`, `editar_conta_a_pagar` (merge parcial sobre o estado atual), `cancelar_conta_a_pagar`, chamando `AccountsPayableService` com o ator do MCP
- [ ] T014 [P] [US2] Testes em `apps/api/test/mcp-payables-actions.integration.spec.ts`: paridade com a tela (SC-002, ocorrências e auditoria com canal), nomes desconhecidos/ambíguos, duplicidade, pagamento parcial/total/excedente, edição parcial, cancelamento com e sem pagamento

## Phase 4: User Story 3 - Importação de vendas (P1)

- [ ] T015 [US3] `tools/sales-import.tools.ts`: `integracoes_de_vendas`, `importar_vendas_previa` (integração por id/nome/provedor, período ou `cargaInicialDias` só no Mercado Pago, atribuição com produto por nome), `importacao_status` (resumo da prévia), `importar_vendas_confirmar` (só prévia pronta), com trigger e canal
- [ ] T016 [P] [US3] Testes em `apps/api/test/mcp-sales-import-actions.integration.spec.ts`: prévia → status → confirmar (SC-003) com processor fake, limites por provedor, sobreposição, confirmação repetida, carga inicial só no Mercado Pago, iFood sem conciliação
- [ ] T017 [US3] Web: histórico de importações mostra a origem (canal) quando houver

## Phase 5: Polish

- [ ] T018 [P] Docs: `docs/USER_GUIDE.md` (seção do MCP: ações, segurança, exemplos), contrato `specs/025-store-mcp-server/contracts/mcp-tools.md` (referência às ações), glossário/instruções do servidor, `docs/DATA_DICTIONARY.md` regenerado
- [ ] T019 Typecheck, lint e suítes de API e web (comparar com o baseline do `develop`)
- [ ] T020 Roteiro do `quickstart.md` no ambiente local e em produção

## Dependencies

Phase 1 → US1 → (US2, US3) → Polish. US2 e US3 podem andar em paralelo depois da US1. T012 é pré-requisito de T013 e T015 (resolução de produto).
