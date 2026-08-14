# Research: Controle de Memória e Processamento em Segundo Plano

## Decision 1 - Preserve modular monolith with deployable roles

**Decision**: Manter um único código NestJS e selecionar o papel `api`, `worker` ou `all` no bootstrap.

**Rationale**: Isola picos e falhas de jobs quando há orçamento separado, preserva regras e transações nos módulos existentes e permite que o piloto continue com um único processo.

**Alternatives considered**:

- Microserviços por integração: rejeitado por elevar memória basal, operação e duplicação de contratos.
- Manter todos os jobs sempre na API: rejeitado porque exportações/importações competem com POS e KDS.
- Plataforma externa de funções: adiada; cria dependência operacional desnecessária para o piloto.

## Decision 2 - PostgreSQL-backed durable queue with leases

**Decision**: Persistir unidades de trabalho no PostgreSQL e reservá-las atomicamente com lease expirável, deduplicação ativa, backoff e heartbeat.

**Rationale**: O PostgreSQL já é obrigatório, suporta múltiplas instâncias e permite retomada sem adicionar broker. O lease torna falhas recuperáveis; a chave ativa impede sobreposição lógica.

**Alternatives considered**:

- Timers e `Set` em memória: rejeitados porque não sobrevivem a restart e não coordenam instâncias.
- Locks consultivos como fila completa: úteis para exclusão curta, mas não fornecem histórico, progresso, prioridade ou retomada.
- Redis/BullMQ: tecnicamente adequado, mas adiciona memória e infraestrutura antes de a escala exigir.

## Decision 3 - Keep domain records and add orchestration reference

**Decision**: `ExportJob`, `SalesImportRun`, `ProviderNotification`, `DeliveryPlatformEvent` e `PaymentCharge` continuam como fontes de verdade dos domínios; `BackgroundJob` guarda apenas orquestração e referência ao alvo.

**Rationale**: Evita duplicar payloads e estados de negócio, permite migração handler por handler e mantém endpoints atuais.

**Alternatives considered**:

- Substituir todos os modelos por uma tabela genérica: rejeitado por perder invariantes e aumentar o risco de migração.
- Adicionar leases diferentes em cada modelo: funciona, mas duplica código, métricas e política de retry.

## Decision 4 - Streaming and database aggregation before caching

**Decision**: Reduzir materialização por agregações no banco, paginação real, cursores e escrita/entrega em stream. Não introduzir cache em memória como primeira otimização.

**Rationale**: O relatório atual carrega pedidos e itens completos e só então aplica `slice`; exportações mantêm dataset, strings e buffers simultaneamente. Cache aumentaria retenção sem corrigir o pico.

**Alternatives considered**:

- Apenas limitar heap: protege o host, mas converte picos em OOM mais cedo.
- Cache de relatórios: pode reduzir CPU, mas aumenta RSS e invalidação; reavaliar somente após consultas agregadas.
- Aumentar o plano de memória: mitigação operacional, não corrige crescimento proporcional ao histórico.

## Decision 5 - S3-compatible assets with legacy reads

**Decision**: Novos uploads e exportações usam armazenamento S3-compatível; base64 e filesystem local permanecem somente para leitura/migração e desenvolvimento.

**Rationale**: Remove cópias base64 de web/API/banco, permite streaming e atende ao padrão constitucional já definido.

**Alternatives considered**:

- Continuar base64 com limite menor: reduz risco, mas mantém amplificação e tráfego duplicado.
- Banco binário: centraliza backup, porém aumenta I/O e tamanho da base operacional.

### Development fallback compatibility

The same upload-intent contract is preserved in local development: production returns an S3-compatible signed `PUT` URL, while local mode returns an authenticated bounded `PUT` endpoint served by the API. Both paths stream bytes, validate the declared metadata on confirmation and return the same asset key shape.

## Decision 5A - Streaming XLSX writer

**Decision**: Substituir a construção manual de ZIP/XML em buffers por uma dependência de escrita XLSX em streaming, adicionada explicitamente ao pacote da API e encapsulada pelo export worker.

**Rationale**: O gerador atual cria arrays, XML completo, partes ZIP e `Buffer.concat`. Um writer de streaming aplica backpressure e reduz cópias simultâneas sem expor a biblioteca aos contratos de domínio.

**Alternatives considered**:

- Reescrever internamente ZIP streaming e CRC: rejeitado pelo custo e risco de manutenção de formato.
- Manter o gerador atual com limite baixo: preserva pico multiplicado e não atende ao requisito incremental.

## Decision 6 - Adaptive polling, not universal realtime

**Decision**: Padronizar polling sem sobreposição, sensível à visibilidade, com backoff/jitter e respostas incrementais. Usar Socket.io existente para KDS como caminho primário, sem migrar todas as telas para realtime.

**Rationale**: Os intervalos atuais são limpos e não indicam leak direto, mas a cada 5 segundos cada aba aloca resposta e executa consultas. A adaptação reduz carga mantendo fallback simples.

**Alternatives considered**:

- Socket.io para tudo: aumenta estado de conexões e complexidade de autorização/reconexão.
- Service Worker compartilhado entre abas: adiado pela complexidade e diferenças de navegador.
- Manter intervalos fixos: rejeitado pela multiplicação linear por aba e falhas sobrepostas.

## Decision 7 - Job-specific urgency and fairness

**Decision**: Prioridades `CRITICAL`, `HIGH`, `NORMAL`, `LOW`, concorrência global inicial 1 e no máximo um job pesado por tenant. Webhooks/pagamentos são críticos; exportações e retenção são baixas.

**Rationale**: Um limite único sem prioridade poderia atrasar eventos operacionais atrás de exportações. Justiça por tenant evita monopolização.

**Alternatives considered**:

- FIFO puro: simples, mas permite head-of-line blocking.
- Concorrência por CPU: inadequada porque a maioria dos trabalhos mistura I/O externo e transformações com picos diferentes.

## Decision 8 - Telemetry in metrics/logs, durable job history in database

**Decision**: Memória e event-loop são métricas de baixa retenção emitidas a cada 30 segundos; início/fim e estado de jobs são persistidos/registrados. Não armazenar cada amostra na base transacional.

**Rationale**: Evita criar uma nova fonte de crescimento e ainda permite correlação operacional.

**Alternatives considered**:

- Tabela de amostras de memória: fácil de consultar, mas exige retenção e gravações contínuas.
- Apenas logs de OOM: insuficiente para distinguir heap, buffers e memória nativa antes do encerramento.

## Current Polling and Job Inventory

| Flow | Current trigger | Current protection | Memory/load finding | Planned adjustment |
|---|---|---|---|---|
| Notification badge | Browser every 5 seconds per admin tab | Timer cleanup on unmount; no in-flight guard | No direct leak found, but each cycle queries list plus unread count and scales by open tabs | Summary-only request, no overlap, visibility pause, 30-second active target, ETag/backoff |
| Notification page | Browser every 5 seconds, up to 50 rows | Timer cleanup on unmount; no in-flight guard | Recreates/transfers the complete visible list even without change | Delta/cursor update, visibility pause, bounded client list |
| Admin session | Browser every 5 minutes | Timer cleanup | Low frequency; not a primary memory risk | Reuse adaptive controller and retain low frequency |
| Public queue | Browser every 5 seconds plus 1-second clock | Both timers cleaned | Repeated query per display; clock forces continuous render | Keep 5-second visible SLA, pause hidden polling and calculate display time without unnecessary permanent rerender |
| KDS | Socket events plus 15-second invalidation | Timer cleanup | Useful recovery path, but every tab refetches snapshots | Socket primary, adaptive recovery polling, no overlap |
| Point charge tracking | Browser interval while charge is active | Cleared by hook lifecycle | Bounded if terminal states stop it; overlapping slow responses remain possible | Abort/no-overlap and guaranteed stop on terminal/unmount |
| iFood events | Server every >=30 seconds and once after startup | Local `pollingRunning`; integrations/events sequential | Good local overlap guard, but all due integrations loaded at once and guard is not distributed | Page integrations, durable per-integration key, bounded fair consumption |
| Point reconciliation | Cron every 2 minutes | Local `running`; database query `take: 25`; sequential charges | Batch is already bounded; two API replicas may claim the same stale set | Durable/distributed charge claim while preserving batch 25 |
| MP reconciliation | Every 15 minutes for 24h and daily for 168h | Per-integration operation lease | All active connections loaded and launched through unbounded `allSettled`; short/daily can coincide | Page connections, shared active key per integration, bounded concurrency |
| MP token refresh | Daily | Per-integration operation lease | All eligible connections loaded and promises launched together | Page and limit concurrency; preserve credential claim |
| Sales import preview/confirm | Request/startup fire-and-forget | In-process `Set` by run plus domain claim | Startup loads all recoverable runs and starts all; work is lost from process on restart | Durable queue, bounded recovery and domain idempotency |
| Provider/payment webhooks | Persist then `setImmediate` | Atomic status claim | Receipt is durable but dispatch is volatile; many receipts can start concurrently | Durable enqueue after receipt with critical priority and retry |
| Export | Request fire-and-forget | Domain status check only | Concurrent in-process jobs; full dataset/string/buffer amplification; expected memory impact HIGH | Worker concurrency 1, dedupe, cursor batches, stream and durable storage |
| Retention | Daily at 2 AM | None | Bulk deletes are not a persistent-memory leak, but large transactions can create load spikes | Bounded delete batches, deadline and continuation |

### Audit conclusion

The browser intervals correctly clear timers and therefore do not currently demonstrate a classic timer-retention leak. Their main cost is multiplicative transient allocation and database/network activity. The highest server-side risks remain full report/export materialization, unbounded startup recovery and `Promise.allSettled` across every eligible integration. iFood is safer than the other schedulers because it is sequential and has a local overlap guard, but it still needs pagination and distributed ownership for horizontal deployment.
