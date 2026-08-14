# Implementation Plan: Controle de Memória e Processamento em Segundo Plano

**Branch**: `018-memory-optimization` | **Date**: 2026-08-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/018-memory-optimization/spec.md`

## Summary

Manter web e API abaixo do limite individual de 512 MB por meio de quatro frentes incrementais: medir memória e carga por fluxo; substituir cargas integrais de relatórios e exportações por agregação, paginação e streaming; tornar polling de navegador adaptativo e sem sobreposição; e executar jobs duráveis com lotes, concorrência limitada e leases distribuídos. O monólito modular é preservado. Um mesmo artefato da API aceita papéis `api`, `worker` ou `all`, permitindo isolar trabalhos pesados sem duplicar domínios ou introduzir um broker obrigatório.

## Technical Context

**Language/Version**: TypeScript, Node.js 20+

**Primary Dependencies**: NestJS, Next.js App Router, React Query, Prisma, PostgreSQL, Socket.io, class-validator

**Storage**: PostgreSQL para fila durável, leases, progresso e dados de negócio; armazenamento S3-compatível para imagens e exportações, com fallback local somente em desenvolvimento

**Testing**: Vitest, Supertest, React Testing Library, Playwright e harness Node de carga/memória

**Target Platform**: Linux, com serviços web e API limitados individualmente a 512 MB e papel opcional de worker em processo separado

**Project Type**: Monorepo web com frontend Next.js, API NestJS modular monolítica e contratos compartilhados

**Performance Goals**: RSS p95 de até 400 MB e pico de até 460 MB por processo; crescimento de heap inferior a 10% após cinco ciclos; notificação administrativa em até 30 segundos p95; preservação das metas existentes de KDS e pagamentos

**Constraints**: nenhuma interrupção de POS/KDS/pagamentos; tenant isolation; jobs idempotentes e retomáveis; sem broker externo obrigatório; payload e arquivos grandes não podem ser materializados integralmente; compatibilidade gradual com registros existentes

**Scale/Scope**: dezenas de lojas, até 20 operadores e 10 terminais por loja, 500 pedidos/dia por loja, 100 jobs recuperáveis no startup e múltiplas instâncias do mesmo papel

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Real Operation First**: Pass. A admissão de jobs prioriza POS, pedidos, KDS, pagamentos e webhooks; relatórios e reconciliações cedem capacidade.
- **TypeScript Strict By Default**: Pass. Estados, payloads, políticas, telemetria e contratos HTTP permanecem explicitamente tipados e validados.
- **Modular Monolith, Domain-Oriented**: Pass. O worker é outro papel do mesmo artefato e reutiliza serviços dos domínios; não cria microserviços de negócio.
- **Tenant Isolation Is A Design Constraint**: Pass. Todo job com dono de negócio carrega `tenantId`; reserva, consulta de status e artefatos respeitam o escopo autenticado.
- **Tests Protect Operational Flow**: Pass. O plano inclui testes de carga repetida, concorrência distribuída, retomada e disponibilidade dos fluxos operacionais.
- **Storage Standard**: Pass. Imagens e exportações convergem para armazenamento S3-compatível com fallback local de desenvolvimento.
- **Quality Gates**: Pass for planning. Spec, research, data model, contracts e quickstart são produzidos; `tasks.md` continua obrigatório antes da implementação.

## Project Structure

### Documentation (this feature)

```text
specs/018-memory-optimization/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- resource-control.openapi.yaml
|-- checklists/
|   `-- requirements.md
`-- tasks.md
```

### Source Code (repository root)

```text
apps/
|-- api/
|   |-- src/
|   |   |-- common/
|   |   |   |-- background-jobs/
|   |   |   |-- observability/
|   |   |   `-- storage/
|   |   |-- management/
|   |   |   |-- exports/
|   |   |   |-- notifications/
|   |   |   |-- reports/
|   |   |   |-- sales-integrations/
|   |   |   `-- integrations/ifood/
|   |   |-- payments/
|   |   `-- main.ts
|   `-- test/
`-- web/
    |-- app/
    |   |-- admin/notifications/
    |   |-- admin/orders/
    |   |-- admin/pos/
    |   `-- (public-menu)/fila/
    |-- components/admin/
    |-- lib/
    |   `-- adaptive-polling/
    `-- tests/
packages/
|-- database/prisma/
|   |-- schema.prisma
|   `-- migrations/
`-- types/src/
scripts/
`-- memory-load/
```

**Structure Decision**: criar infraestrutura transversal mínima em `apps/api/src/common` para jobs, telemetria e storage, mantendo handlers e regras nos módulos proprietários. O frontend recebe um utilitário compartilhado de polling adaptativo. O papel de execução é configurado no bootstrap da API para que a mesma base rode como `api`, `worker` ou `all`.

## Architecture and Delivery Strategy

### Increment 1 - Measurement and guardrails

- Registrar `rss`, `heapUsed`, `heapTotal`, `external`, `arrayBuffers`, event-loop lag e jobs ativos.
- Coletar a memória interna da API e observar externamente, por PID/container, tanto o servidor Next quanto a API para aplicar os mesmos critérios de RSS.
- Correlacionar amostras no início/fim de operações pesadas, sem persistir payload sensível.
- Configurar teto de heap, limite de corpo, pool de conexões, Swagger somente fora de produção e Next standalone.
- Criar harness antes/depois com cinco ciclos e soak de 8 horas.

### Increment 2 - Query and asset pressure

- Dividir relatório de vendas em consultas agregadas e página analítica real no banco.
- Evitar quatro coleções grandes simultâneas no relatório gerencial.
- Paginar contas a pagar e demais listagens interativas sem `slice` em memória.
- Validar arquivo antes da conversão, migrar imagens para object storage e manter leitura compatível de base64 legado.

### Increment 3 - Durable background work and streaming

- Introduzir `BackgroundJob` com deduplicação, prioridade, `availableAt`, tentativas, lease e progresso.
- Usar reserva atômica curta; chamadas externas e transformação ocorrem fora da transação.
- Enfileirar exportações, imports recuperados, webhooks e reconciliações; handlers continuam nos domínios.
- Exportar CSV por stream e consultar dados por cursor. XLSX usa escrita incremental. PDF gerencial permanece limitado a dados agregados e tabelas explicitamente limitadas.
- Armazenar resultado em object storage e expirar metadados/objetos por retenção.

### Increment 4 - Job inventory migration

- **iFood**: scheduler enfileira integrações elegíveis por páginas; uma chave por integração impede sobreposição; eventos continuam sequenciais por integração e são limitados por lote.
- **Mercado Pago reconciliation**: ciclos curto e diário geram chaves compatíveis que impedem execução simultânea na mesma integração; concorrência baixa e justa por tenant.
- **Mercado Pago token refresh**: paginação de conexões e concorrência limitada, reaproveitando o lock de integração existente durante a transição.
- **Point reconciliation**: lote de 25 preservado, com claim durável por cobrança e exclusão entre instâncias.
- **Sales import**: startup apenas sinaliza jobs recuperáveis; workers consomem até a concorrência permitida.
- **Webhooks**: persistência e resposta rápida já existentes passam a enfileirar processamento durável, removendo `setImmediate` volátil.
- **Retention**: exclusões paginadas com deadline e continuação em próximo ciclo.

### Increment 5 - Adaptive client updates

- Criar controlador de polling que aguarda a resposta anterior, aborta no unmount, pausa/reduz em aba oculta e aplica backoff com jitter.
- Indicador de notificação usa endpoint de resumo e versão/ETag; lista usa cursor `since` e mantém no máximo 50 itens.
- KDS mantém Socket.io como caminho primário e polling de recuperação menos frequente.
- Fila pública mantém até 5 segundos em primeiro plano, reduz frequência em aba oculta e evita relógio de um segundo quando a exibição não depende dele.
- Acompanhamento Point preserva urgência apenas para cobrança ativa e encerra ao atingir estado terminal.

## Background Job Execution Design

```text
scheduler/request/webhook
        |
        v
  durable enqueue -- unique active key --> existing job
        |
        v
  PENDING/RETRY_WAIT
        |
  atomic lease (ordered by priority, availableAt, createdAt)
        |
        v
     RUNNING ---- heartbeat/lease ----> recovery after expiry
        |
        +--> SUCCEEDED
        +--> RETRY_WAIT (bounded backoff + jitter)
        +--> FAILED / CANCELLED
```

- Concorrência padrão do worker: `1`; handlers leves podem declarar limite maior, nunca ilimitado.
- Justiça: no máximo um job pesado ativo por tenant e rotação por `availableAt/createdAt`.
- Backpressure: acima do orçamento seguro, o worker deixa de reservar jobs de prioridade baixa, mas termina o job já reservado quando seguro.
- Deploy inicial pode usar `APP_ROLE=all`; produção sob 512 MB deve preferir `api` e `worker` separados quando o provedor permitir orçamento independente.
- O banco é a fonte de verdade. Timers apenas descobrem trabalho; não possuem o trabalho.

## Report and Export Design

- Totais e dimensões usam agregações no banco; a página analítica aplica `skip/take` inicialmente e cursor em exportações.
- Intervalo interativo padrão/máximo: 31/92 dias; acima disso, somente exportação em background.
- `ExportJob` atual permanece como contrato de negócio e referencia um `BackgroundJob`; não se cria segundo conceito visível ao usuário.
- CSV e download são streams com backpressure. O tamanho do batch começa em 250 linhas e é configurável.
- XLSX substitui o construtor ZIP/buffer atual por um writer XLSX de streaming mantido como dependência explícita; a implementação escreve linhas e partes compactadas diretamente no destino.
- Formatos com custo elevado possuem limite de linhas: PDF tabular 1.000; XLSX 50.000; CSV usa limite de negócio e processamento incremental.
- Exportações duplicadas ativas usam fingerprint de tenant, solicitante, contexto, formato, filtros e colunas.

## Memory Observability and Admission

- Amostragem periódica padrão a cada 30 segundos e eventos no início/fim de jobs.
- Faixa normal: RSS abaixo de 400 MB; atenção entre 400 e 440 MB; alta pressão acima de 440 MB; pico de segurança 460 MB.
- Atenção e alta pressão exigem duas amostras consecutivas; a recuperação também exige duas amostras abaixo do respectivo limite para evitar oscilação.
- Em alta pressão, novas tarefas `LOW/NORMAL` não são reservadas; `CRITICAL` permanece para webhooks/pagamentos.
- Métricas são emitidas para o coletor da plataforma e logs estruturados; não se cria tabela de alta cardinalidade para cada amostra.
- O harness de soak coleta RSS do processo web e da API por PID/container, além da telemetria detalhada emitida pela API.
- Alertas incluem papel do processo, memória, jobs ativos, handler, duração e contagem, nunca payload.

## API and Compatibility

- Novos endpoints de notificação são aditivos; o endpoint de lista atual continua funcionando.
- Status de exportação ganha progresso e fila sem remover campos existentes.
- Upload direto usa intenção assinada e confirmação; durante migração, URLs e base64 existentes continuam legíveis.
- Em produção, a intenção retorna URL assinada S3-compatível; no fallback local retorna um endpoint autenticado de `PUT` com o mesmo limite e sem materialização integral.
- Exportações expiram em sete dias por padrão; a retenção é configurável e a exclusão remove metadado e objeto.
- `APP_ROLE=all` preserva desenvolvimento local e deploy simples.
- Cada migração de job mantém feature flag para voltar temporariamente ao scheduler legado, mas ambos nunca ficam ativos juntos.

## Test Strategy

- Unitários: política de polling, backoff, dedupe, transições, lease, admissão por memória e limites de arquivo.
- Integração: reserva concorrente em duas instâncias, lease expirado, justiça por tenant, streaming por cursor e agregações equivalentes ao resultado atual.
- E2E: export/import aceita, progride e retoma; webhook sobrevive a restart; iFood e MP não duplicam efeitos; polling pausa e retoma.
- Performance: 100 jobs recuperáveis, relatórios com milhares de pedidos/itens, duas exportações solicitadas, uploads de fronteira e 40 abas simuladas.
- Soak: cinco ciclos e 8 horas, com GC natural e coleta de RSS/heap/external/arrayBuffers.

## Rollout and Rollback

1. Entregar métricas e limites sem alterar fluxo.
2. Otimizar consultas e imagens, comparar baseline.
3. Ativar fila para exportações com worker no papel `all` e concorrência 1.
4. Separar papel `worker` se houver limite de memória independente.
5. Migrar imports, webhooks e schedulers um por vez, validando contagem e latência.
6. Ativar polling adaptativo por tela.
7. Remover caminhos legados após janela estável.

Rollback ocorre por categoria de handler, nunca desligando persistência ou idempotência. Jobs já persistidos permanecem recuperáveis após reativação.

## Constitution Check - Post Design

- **Real Operation First**: Pass. Filas e admissão priorizam fluxos críticos e entregas são incrementais.
- **Strict Contracts**: Pass. Estados, leases, endpoints e limites estão definidos nos artefatos.
- **Modular Monolith**: Pass. Um papel de worker do mesmo artefato substitui microserviços e broker adicionais.
- **Tenant Isolation**: Pass. Modelo, dedupe, visibilidade e justiça incluem tenant quando aplicável.
- **Operational Tests**: Pass. Cenários cobrem reinício, múltiplas instâncias, memória, integrações e polling.
- **Scope Discipline**: Pass. Não inclui plataforma genérica de workflow nem reformulação de domínios; trata apenas trabalhos existentes e pressão de memória.

## Complexity Tracking

Nenhuma violação constitucional identificada.
