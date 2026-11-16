# Feature Specification: Eficiência de armazenamento e da tela de importação de vendas

**Feature Branch**: `030-import-storage-efficiency`
**Created**: 2026-11-16
**Status**: Draft
**Input**: "Pela manhã eu logo no sistema. A tela de importação de pedidos é muito lenta e por vezes demora e estoura limite, essa tela precisamos analisar e refatorar." Mais os achados da verificação de saúde da produção em 16/11 (OOM da API, crescimento do banco e storage).

## Contexto

A produção roda desde 13/11 com a importação automática de vendas (spec 029, US5) ligada para Mercado Pago e PagBank. A verificação de 16/11 encontrou quatro problemas ligados entre si:

1. **A tela de importação carrega o catálogo inteiro.** Para preencher a lista de produtos (nome e preço), a página busca produtos, categorias e fichas técnicas. Os 36 produtos com foto guardam a imagem como texto base64 dentro do banco: são 44 MB numa tabela de 40 linhas, com até 2,1 MB por produto. Cada abertura da tela trafega dezenas de MB. A tela fica lenta, às vezes estoura o tempo limite, e a memória da API sobe cerca de 250 MB no primeiro acesso do dia sem voltar. Em 14/11 isso derrubou a API por falta de memória (limite de 512 MB).
2. **A importação automática regrava tudo a cada 2 minutos.** Cada ciclo cria uma execução nova e grava de novo todos os movimentos do dia, com o payload bruto do provedor. Em 15/11 o Mercado Pago gerou 9.404 linhas de movimento para cerca de 70 vendas reais. A tabela de movimentos já ocupa 117 MB (metade do banco) e tem 25.650 linhas, das quais só 4.380 são movimentos distintos.
3. **A retenção não acompanha esse volume.** Execuções só são apagadas depois de 180 dias. O banco tem 1 GB de disco, sem crescimento automático. No ritmo atual (~40 MB/dia), o disco lota em 2 a 3 semanas e a aplicação inteira para.
4. **O storage de arquivos em produção é local.** No servidor da API, o disco local é apagado a cada deploy. Os 171 XMLs de NFC-e autorizadas foram gravados nesse storage, e houve 4 deploys desde 13/11. A legislação exige guardar o XML por 5 anos. As notas continuam disponíveis no provedor fiscal (Bling).

Decisões tomadas com o usuário:

- **Ordem de prioridade**: primeiro conter o crescimento do banco (prazo do disco), depois a tela de importação, depois as imagens.
- **A falha matinal do PagBank (`PREVIEW_FAILED`) é esperada**: o PagBank só disponibiliza os dados do dia ao longo do dia. Ela fica fora do escopo e não deve ser tratada como erro nesta spec.
- **Storage de produção** *(atualizado em 2026-11-16)*: era local. O usuário criou um bucket no **Cloudflare R2** e ligou o storage S3 em produção às 11:39 de 16/11. Um envio de imagem de teste gravou corretamente.
- **Organização do bucket por tipo e depois por loja**: `fiscal/`, `images/` e `exports/` na raiz, para que cada tipo tenha sua regra de retenção no próprio bucket.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Importação automática sem inflar o banco (Priority: P1)

Como dono da loja, eu quero que a importação automática continue criando os pedidos a cada 2 minutos sem fazer o banco crescer descontroladamente, para que o sistema não pare por falta de espaço.

**Why this priority**: Tem prazo. Sem isso, o disco do banco lota em 2 a 3 semanas e todo o sistema fica fora do ar.

**Independent Test**: Com a importação automática ligada, simular um dia com 70 vendas e 720 ciclos por provedor. Ao fim do dia, o número de movimentos guardados deve ficar próximo do número de vendas reais, e não na casa dos milhares. Os pedidos e as NFC-e automáticas continuam sendo criados como antes.

**Acceptance Scenarios**:

1. **Given** um ciclo automático em que o provedor devolve vendas já importadas em ciclos anteriores, **When** o ciclo termina, **Then** essas vendas não são gravadas de novo como movimentos e nenhum pedido duplicado é criado.
2. **Given** um ciclo automático sem nenhuma venda nova, **When** o ciclo termina, **Then** o registro desse ciclo é mantido só pelo tempo necessário para diagnóstico (ver FR-005) e depois some.
3. **Given** um ciclo automático com vendas novas, **When** o ciclo termina, **Then** só as vendas novas são gravadas e importadas, os pedidos são criados e a emissão automática da NFC-e segue o fluxo da spec 029.
4. **Given** o acúmulo já existente (25 mil movimentos, sendo cerca de 21 mil repetidos), **When** a limpeza da implantação roda, **Then** os movimentos repetidos e as execuções automáticas sem novidade são removidos sem apagar nenhum pedido, identidade de venda externa, estado de transação ou vínculo usado pela conciliação.
5. **Given** a saúde da importação automática (última importação, atraso, falhas seguidas), **When** consultada na tela, **Then** continua correta depois da mudança.
6. **Given** uma importação manual de um período, **When** feita pela tela, **Then** a pré-visualização continua mostrando todas as vendas do período (novas e já existentes) para conferência, como hoje.

---

### User Story 2 - Tela de importação rápida (Priority: P1)

Como dono da loja, eu quero abrir a tela de importação de vendas pela manhã e usá-la sem demora, para conferir e importar as vendas sem estourar o tempo limite nem derrubar o sistema.

**Why this priority**: É a queixa direta do usuário e o gatilho dos picos de memória que derrubaram a API.

**Independent Test**: Abrir a tela de importação com o catálogo atual (40 produtos, 36 com foto em base64) e medir o volume trafegado e o tempo até a tela ficar utilizável. A tela não pode carregar foto, ficha técnica nem categorias para montar a lista de produtos.

**Acceptance Scenarios**:

1. **Given** a tela de importação, **When** aberta, **Then** a lista de produtos (para "produto fixo") traz só o necessário: identificador, nome, preço e se está ativo.
2. **Given** a aba "API" com um provedor selecionado, **When** o usuário troca de provedor, **Then** só os dados do provedor escolhido são carregados.
3. **Given** o histórico de execuções, **When** exibido, **Then** mostra as execuções mais recentes de forma paginada e permite separar manuais e automáticas, sem ficar soterrado pelos ciclos automáticos de 2 em 2 minutos.
4. **Given** a primeira abertura do dia, **When** a tela carrega, **Then** a memória da API não cresce de forma relevante (ver SC-003).

---

### User Story 3 - Guardar arquivos num storage persistente e recuperar os XMLs fiscais (Priority: P1)

Como dono da loja, eu quero que os arquivos do sistema (XML e DANFE das NFC-e e imagens) fiquem num storage que sobrevive a deploys e reinícios, e que os XMLs já perdidos sejam recuperados do provedor fiscal, para cumprir a guarda legal de 5 anos e não perder documentos.

**Why this priority**: Obrigação legal. Cada deploy pode estar apagando XMLs de notas autorizadas.

**Independent Test**: Com o storage persistente configurado, fazer um deploy e confirmar que o XML de uma nota autorizada antes do deploy continua disponível para download e para a exportação ao contador. Rodar a recuperação e confirmar que toda nota autorizada ou cancelada tem o XML disponível.

**Acceptance Scenarios**:

1. **Given** o storage persistente configurado em produção, **When** a API é reimplantada ou reiniciada, **Then** os arquivos gravados antes continuam disponíveis.
2. **Given** notas autorizadas ou canceladas cujo XML não existe mais no storage, **When** a recuperação roda, **Then** o XML (e a DANFE, quando o provedor disponibilizar) é baixado de novo do provedor e gravado no storage persistente.
3. **Given** uma nota cujo arquivo não pode ser recuperado do provedor, **When** a recuperação termina, **Then** a nota aparece numa lista de pendências com o motivo, para ação manual.
4. **Given** a produção sem storage persistente configurado, **When** a API sobe, **Then** isso fica visível como alerta de configuração (log de aviso e indicação na prontidão fiscal), em vez de falhar em silêncio.
5. **Given** um XML ou DANFE gravado, **When** o contador procura as notas de um mês, **Then** o arquivo está na pasta do mês da emissão no horário de Brasília (uma nota das 22h do dia 31 fica no mês do dia 31).
6. **Given** uma exportação de relatório gerada, **When** passam 7 dias, **Then** o arquivo some do bucket sozinho.
7. **Given** os arquivos fiscais no bucket, **When** alguém tenta apagá-los ou sobrescrevê-los antes de 5 anos, **Then** o bucket recusa.

---

### User Story 4 - Imagens de produtos fora do banco (Priority: P2)

Como dono da loja, eu quero que as fotos dos produtos fiquem guardadas como arquivos, e não dentro do banco, para que as telas que listam produtos fiquem leves e o banco não cresça com imagens.

**Why this priority**: Resolve a causa raiz do volume trafegado e da memória em todas as telas que listam produtos, não só na de importação. Depende do storage persistente (US3).

**Independent Test**: Migrar as 36 fotos atuais para o storage. Confirmar que o cardápio público, o cadastro de produtos e o PDV continuam mostrando as fotos, e que a tabela de produtos encolhe de 46 MB para menos de 1 MB.

**Acceptance Scenarios**:

1. **Given** um produto com foto em base64, **When** a migração roda, **Then** a foto é gravada no storage persistente, o produto passa a referenciar o arquivo e o base64 sai do banco.
2. **Given** o cadastro de produto, **When** o usuário envia uma nova foto, **Then** ela vai direto para o storage, e o banco recebe só a referência.
3. **Given** qualquer listagem de produtos do admin, **When** carregada, **Then** traz no máximo a referência ou o endereço da foto, nunca o conteúdo da imagem.
4. **Given** o cardápio público com fotos ativas, **When** aberto, **Then** as fotos aparecem como antes.
5. **Given** uma falha ao gravar uma foto no storage durante a migração, **When** a migração termina, **Then** o produto mantém a foto original e o caso fica registrado para nova tentativa. Nenhuma foto é perdida.

---

### Edge Cases

- Uma venda reaparece no provedor com valor ou status diferente (estorno, cancelamento) depois de importada: a mudança precisa continuar chegando ao estado da transação e à conciliação, mesmo que a venda não seja regravada como movimento novo.
- Perto da meia-noite o ciclo automático também consulta o dia anterior (janela de 10 minutos): as vendas da véspera já importadas não podem ser regravadas.
- Uma importação manual roda sobre um período que a importação automática já cobriu: a pré-visualização mostra as vendas como "já existentes", e a confirmação não duplica pedidos.
- A limpeza do acúmulo roda com a importação automática ativa: ela não pode travar a importação nem estourar o tempo de uma transação. Precisa rodar em lotes.
- O storage persistente fica indisponível momentaneamente: o envio de foto ou a gravação do XML falha com mensagem clara e uma nova tentativa é agendada. A emissão da nota não é desfeita.
- Imagens de identidade visual da loja (logo, cabeçalho, rodapé), que também estão em base64 (cerca de 7 MB): seguem a mesma regra das fotos de produto.
- A importação automática de iFood não existe hoje. Se for ligada no futuro, segue a mesma regra de não regravar o que já foi importado.

## Requirements *(mandatory)*

### Functional Requirements

**Importação automática e retenção (US1)**

- **FR-001**: O ciclo automático MUST gravar como movimento apenas as vendas que ainda não têm identidade de venda externa registrada para a loja, o provedor e o ambiente.
- **FR-002**: O ciclo automático MUST continuar atualizando o estado da transação no provedor (status, valores, data de liberação) para vendas já importadas, sem criar um movimento novo para elas.
- **FR-003**: O ciclo automático MUST continuar calculando o atraso das vendas e a saúde da integração (última importação, falhas seguidas, atraso) da mesma forma vista pelo usuário.
- **FR-004**: A pré-visualização manual MUST continuar mostrando todas as vendas do período, classificadas em novas, já existentes (duplicadas) e rejeitadas.
- **FR-005**: O sistema MUST remover execuções automáticas sem venda nova depois de 2 dias, e o payload bruto dos movimentos já importados depois de 30 dias. Valores, status, identificadores e vínculos com pedidos ficam guardados pelo prazo atual de 180 dias.
- **FR-006**: O sistema MUST ter uma limpeza única do acúmulo atual, executável em lotes e de forma idempotente, que remova movimentos repetidos e execuções automáticas sem novidade, preservando pedidos, identidades de venda externa, estados de transação e qualquer vínculo usado pela conciliação.
- **FR-007**: O sistema MUST registrar em log, a cada limpeza, quantos registros foram removidos e quanto tempo levou.

**Tela de importação (US2)**

- **FR-008**: A tela de importação MUST obter a lista de produtos por uma consulta enxuta, que retorne só identificador, nome, preço e se está ativo.
- **FR-009**: A tela de importação MUST NOT carregar categorias, fichas técnicas nem imagens de produto.
- **FR-010**: O histórico de execuções MUST ser paginado e MUST permitir filtrar por origem (manual ou automática), com padrão de exibir as manuais.
- **FR-011**: Os painéis de cada provedor (PagBank, Mercado Pago, iFood) MUST carregar seus dados só quando o provedor for selecionado.

**Storage persistente e XMLs fiscais (US3)**

- **FR-012**: A produção MUST usar um storage de arquivos persistente compatível com S3 para todos os arquivos (XML e DANFE das NFC-e, imagens).
- **FR-013**: A API MUST emitir um aviso de configuração ao subir em produção com storage local, e a prontidão fiscal MUST indicar o problema.
- **FR-014**: O sistema MUST ter uma rotina de recuperação que, para cada nota autorizada ou cancelada, verifique se o XML existe no storage e, se não existir, baixe de novo do provedor e grave.
- **FR-015**: Notas cujo XML não puder ser recuperado MUST aparecer nas pendências fiscais com o motivo.
- **FR-015a**: Todos os arquivos MUST seguir a organização por tipo e depois por loja: `fiscal/{loja}/{ano}/{mês}/...` para XML, XML de cancelamento e DANFE; `images/{loja}/{finalidade}/...` para imagens; `exports/{loja}/{exportação}/...` para exportações.
- **FR-015b**: O ano e o mês da pasta fiscal MUST ser os da data de emissão no horário de Brasília.
- **FR-015c**: O bucket MUST ter uma regra que expire `exports/` em 7 dias e uma trava de retenção de 5 anos para `fiscal/`. Essa configuração fica documentada no guia de implantação.

**Imagens fora do banco (US4)**

- **FR-016**: Novas fotos de produto e imagens de identidade visual MUST ser gravadas no storage persistente, e o banco MUST guardar só a referência.
- **FR-017**: O sistema MUST ter uma migração, em lotes e idempotente, que mova as imagens base64 existentes (produtos e identidade visual) para o storage e só então substitua o valor no banco pela referência.
- **FR-018**: Nenhuma listagem de produtos do admin MUST devolver o conteúdo de uma imagem: só a referência ou um endereço para buscá-la.
- **FR-019**: Depois da migração, o sistema MUST recusar novos valores base64 no cadastro de produtos e de identidade visual.
- **FR-020**: Quando uma imagem for substituída ou o produto excluído, o arquivo antigo MUST ser removido do bucket.

**Runtime (transversal)**

- **FR-021**: A API MUST rodar numa versão do Node.js suportada pelas bibliotecas de storage (Node 22 ou superior), com build e testes validados nessa versão.

### Key Entities

- **Execução de importação**: um pedido de consulta ao provedor para um período, manual ou automática, com contagens e status. Execuções automáticas sem venda nova passam a ser temporárias.
- **Movimento externo**: uma venda ou evento devolvido pelo provedor dentro de uma execução. Passa a ser gravado só quando é novo (no automático) ou quando o usuário pede pré-visualização (no manual).
- **Identidade de venda externa**: o registro de que uma venda do provedor já virou pedido. É a referência para não duplicar e não pode ser apagada pela limpeza.
- **Estado da transação no provedor**: a situação atual de cada transação (status, valores, liberação), usada pela conciliação. Continua sendo atualizado a cada ciclo.
- **Arquivo armazenado**: XML, DANFE ou imagem guardado no storage persistente e referenciado pelo banco por uma chave.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Num dia normal (até 150 vendas), a importação automática acrescenta no máximo 5 MB ao banco, contra ~40 MB/dia hoje.
- **SC-002**: Depois da limpeza única, a tabela de movimentos externos ocupa menos de 20% do tamanho atual (117 MB), e o banco inteiro fica abaixo de 100 MB.
- **SC-003**: A tela de importação fica utilizável em até 3 segundos na primeira abertura do dia, trafega menos de 200 KB para montar a página e não faz a memória da API crescer mais de 30 MB.
- **SC-004**: Nenhuma reinicialização por falta de memória na API ao longo de 7 dias seguidos após a implantação.
- **SC-005**: 100% das NFC-e autorizadas ou canceladas têm XML disponível para download depois da recuperação, e continuam disponíveis depois de um novo deploy.
- **SC-006**: A tabela de produtos ocupa menos de 1 MB depois da migração das imagens, e o cardápio público continua mostrando 100% das fotos ativas.
- **SC-007**: Nenhum pedido duplicado ou faltante e nenhuma NFC-e automática a menos, comparando a semana anterior e a posterior à implantação com o mesmo volume de vendas.

## Assumptions

- O bucket Cloudflare R2 já está ligado em produção (16/11, 11:39) e foi validado com um envio de imagem. A imagem de teste ficou na chave antiga (`tenants/...`) e será regravada pela migração da US4.
- O Bling mantém o XML das NFC-e emitidas e permite baixá-lo pela consulta da nota, como já usado na spec 029.
- Os prazos de retenção (2 dias para execuções automáticas sem novidade, 30 dias para o payload bruto) bastam para diagnóstico. O prazo atual de 180 dias para os dados de conciliação não muda.
- A falha matinal do PagBank (`PREVIEW_FAILED`) é comportamento do provedor e fica fora do escopo.
- A tela de importação por arquivo (CSV) não muda de comportamento. Só deixa de carregar dados que não usa.
- Há uma loja em produção. As regras valem por loja (tenant) e precisam manter o isolamento entre lojas.
