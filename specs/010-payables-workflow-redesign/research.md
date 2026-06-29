# Research: Repaginacao do Fluxo de Contas a Pagar

## Decision: Reutilizar summary existente para os cards sempre visiveis

**Rationale**: A API de contas a pagar ja retorna `summary` junto da lista, com total previsto, pago, em aberto e vencido. A mudanca principal e de experiencia: os cards devem permanecer acima da consulta/lista e refletir os filtros aplicados.

**Alternatives considered**:

- Criar endpoint separado para indicadores: rejeitado por duplicar calculo e aumentar chance de divergencia entre lista e cards.
- Calcular indicadores somente no frontend: rejeitado porque regras de status e valores ja estao centralizadas no backend.

## Decision: Usar modais para inclusao, edicao e detalhes com formulario reutilizavel

**Rationale**: `PayableForm` e `PayableDetailDialog` ja existem, e `payables-client.tsx` ja controla `selectedPayable` e `editingPayable`. O menor risco e promover o formulario inline de nova conta e a edicao inline para dialogos, mantendo validacoes e handlers atuais.

**Alternatives considered**:

- Criar paginas dedicadas para nova conta/edicao: rejeitado porque contraria a spec de manter contexto na tela principal.
- Manter formulario inline e apenas estilizar: rejeitado porque nao atende ao requisito de modal.

## Decision: Solicitar exportacao por job persistido em segundo plano

**Rationale**: A spec exige que exportacao nao seja sincronona. Um job persistido permite retornar rapidamente ao usuario, acompanhar status, tratar falhas e gerar notificacao mesmo se o usuario continuar navegando.

**Alternatives considered**:

- Gerar arquivo diretamente na requisicao HTTP: rejeitado por bloquear a tela e falhar em volumes maiores.
- Gerar arquivo no navegador: rejeitado por duplicar regras de filtros/permissoes e expor mais dados ao cliente.
- Adotar fila externa agora: rejeitado por complexidade operacional desnecessaria para o piloto; o modelo deve permitir evoluir para fila externa depois.

## Decision: Criar infraestrutura de exportacao reutilizavel por contexto

**Rationale**: Contas a pagar e o primeiro consumidor, mas a intencao do produto e reutilizar o mesmo fluxo em outras telas. A implementacao deve separar job, status, storage, formatadores e componente de acionamento do provider especifico de dados. Cada tela fornece contexto, filtros, colunas e permissao; a infraestrutura comum cuida de fila interna, arquivo, download e notificacao.

**Alternatives considered**:

- Implementar um job totalmente acoplado a contas a pagar: rejeitado por gerar retrabalho e contratos duplicados quando outra tela precisar exportar.
- Criar apenas um componente visual reutilizavel e manter backend especifico por tela: rejeitado porque ainda duplicaria job/status/notificacao/download.
- Criar uma plataforma de relatorios generica ampla agora: rejeitado por escopo excessivo; a decisao e uma base pequena por contexto, validada primeiro em contas a pagar.

## Decision: Snapshot dos filtros no momento da solicitacao

**Rationale**: O usuario espera que o arquivo represente a consulta que ele exportou, mesmo que altere filtros depois. Persistir os filtros no job tambem facilita auditoria e repeticao.

**Alternatives considered**:

- Ler filtros atuais do usuario no momento do processamento: rejeitado porque produziria arquivos inesperados.
- Exportar sempre toda a base: rejeitado porque nao respeita o fluxo de consulta.

## Decision: Centro de notificacoes persistido por usuario e tenant

**Rationale**: Notificacoes de exportacao precisam continuar acessiveis fora da tela de contas a pagar. Persistir leitura/status por usuario evita perda de mensagens e preserva isolamento.

**Alternatives considered**:

- Toast temporario apenas na tela: rejeitado porque o usuario pode navegar antes do job terminar.
- Notificacao global sem usuario: rejeitado porque pode expor resultados entre usuarios e tenants.

## Decision: Contrato unico para CSV, PDF e XLSX

**Rationale**: Os tres formatos compartilham a mesma consulta, status e notificacao. Um contrato unico com enum de formato reduz duplicidade e deixa testes mais simples.

**Alternatives considered**:

- Um endpoint por formato: rejeitado por triplicar logica de permissao/status.
- Formato livre por string: rejeitado por abrir espaco para entradas invalidas em fronteira externa.
