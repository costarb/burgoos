# Feature Specification: Módulo Fiscal — Emissão de NFC-e por Provedor Configurável

**Feature Branch**: `029-fiscal-nfce`
**Created**: 2026-10-30
**Status**: Draft
**Input**: "Preciso criar um modulo fiscal, para chamar serviço que faça emissão de NFC-e, inicialmente quero utilizar o BLING para fazer a emissão, mas quero que a arquitetura seja possivel escolher qual provedor. Portanto, temos que prever configuração para escolher qual o provedor que irá realizar a emissão, certificado A1, ter controle nas vendas da NFC emitida, se houver cancelamento do pedido, realizar cancelamento da NFC, sempre seguindo a arquitetura do sistema para as configurações ser por empresa."

## Contexto

Hoje o sistema não tem dados fiscais: a empresa (`Tenant`) guarda endereço no perfil da loja (`config.address`: rua, número, complemento, bairro, cidade, UF, CEP), mas não guarda CNPJ, IE, razão social, regime nem código IBGE do município. Os produtos e complementos não têm NCM, CFOP ou CSOSN. A constituição lista "Fiscal/NF-e" como item adiado; **esta spec promove a emissão de NFC-e para o escopo**.

A emissão é feita por um **provedor fiscal** escolhido por empresa. O primeiro provedor é o **Bling** (API v3, OAuth2). A arquitetura segue o padrão das integrações de vendas: um contrato único de provedor, um registro de adapters, credenciais criptografadas, auditoria e processamento em background. A empresa piloto fica em **São Paulo (SP)**.

Decisões tomadas com o usuário:

- **Gatilho configurável por empresa**: emissão automática ou manual. O botão manual também serve para reprocessar falhas e para pedidos fora da regra automática.
- **Origens elegíveis nesta fase**: balcão/comandas, pedidos importados e pedidos via API. Cardápio público e iFood ficam fora.
- **Emissão automática só para vendas do dia**: pedidos com data de venda anterior ao dia corrente nunca são emitidos automaticamente; ficam disponíveis para emissão manual, com aviso de risco.
- **Meta de 5 minutos**: um job de importação automática roda a cada 2 minutos, para que a NFC-e de uma venda importada seja emitida em até 5 minutos após a venda.
- **Tributação por perfis fiscais no ERP**: perfis reutilizáveis atribuídos à categoria (padrão) e sobrescrevíveis no produto e no complemento. Não depende do provedor.
- **Somente Simples Nacional** (CSOSN) nesta fase.
- **Complementos pagos viram itens próprios da nota** (ver FR-021 e a seção Pesquisa).
- **Cancelamento**: cancelar ou excluir um pedido com nota autorizada dispara o cancelamento da NFC-e. Alterar itens de um pedido com nota autorizada é bloqueado. **O Bling não tem endpoint público para cancelar NFC-e**: para esse provedor, o cancelamento é assistido (o ERP sinaliza com urgência, o usuário cancela no painel do Bling e o ERP detecta o cancelamento pela consulta da nota).
- **Certificado A1 armazenado no ERP** (arquivo e senha criptografados, com validade e alerta). É enviado ao provedor só se ele suportar; no Bling serve apenas para controle e alerta.
- **Dados do emitente no cadastro da loja** *(revisado em 2026-10-30)*: razão social, nome fantasia, CNPJ, IE, regime tributário e código IBGE fazem parte do **cadastro da loja**, junto com o endereço. A plataforma inclui, altera e desativa lojas; o admin da loja vê e altera somente os dados da própria loja (nome, telefone, endereço, redes sociais e dados fiscais), sem mexer em slug, domínio ou ativação. A tela fiscal apenas exibe esses dados e o que falta para emitir.
- **CPF/CNPJ na nota** opcional no balcão/comanda.
- **DANFE**: link/PDF no pedido, impressão, link no WhatsApp e exportação em lote dos XMLs para o contador.
- **XML e DANFE copiados para o storage do ERP**.
- **Falhas**: retry em background para falhas técnicas e fila de pendências para rejeições. Contingência offline fica fora.
- **Configuração** pelo admin da empresa com nova permissão "Fiscal". O app OAuth do Bling fica na configuração de plataforma, como Mercado Pago e PagBank.

## Pesquisa realizada

**Complementos e adicionais.** A prática de mercado é lançar o adicional como item próprio da NFC-e, com NCM e CFOP próprios. O exemplo citado é o McDonald's, onde o queijo adicional é um item da nota. Somar ao item principal esconderia mercadorias com tributação diferente (por exemplo, bebida com ST dentro de um lanche) e impediria o perfil fiscal correto. Fontes: [fórum Contábeis — itens do tipo combo](https://www.contabeis.com.br/forum/tributos-estaduais-municipais/295308/nota-fiscal-do-consumidor-itens-do-tipo-combo/), [Projeto ACBr — NFC-e com serviços](https://www.projetoacbr.com.br/forum/topic/24527-nfc-e-com-servi%C3%A7os-iss/).

**Gorjeta / taxa de serviço (SP).** A [Resposta à Consulta SEFAZ-SP 33566/2026](https://legislacao.fazenda.sp.gov.br/Paginas/RC33566_2026.aspx) diz que a gorjeta de até 10% pode sair da base do ICMS se for discriminada como item separado: CFOP 5.949, NCM "99", tributação de isenção (CST 40 no regime normal) e cBenef preenchido (Portaria SRE 70/2025). Se os requisitos não forem atendidos, a gorjeta é rateada entre os itens e tributada. Hoje o pedido não registra taxa de serviço, então a regra fica preparada, mas sem uso nesta fase.

**Taxa de entrega.** Quando existir no pedido, é rateada proporcionalmente entre os itens no campo de frete e compõe a base de cálculo de cada item. Fonte: [Cartilha NFC-e SEFAZ-AM](https://portalnfce.sefaz.am.gov.br/wp-content/uploads/2014/05/Cartilha15X21CM-NFC-e-SEFAZ_FINAL_reduzido.pdf). Hoje o pedido não registra taxa de entrega separada.

**API v3 do Bling** (levantamento do usuário na referência e no OpenAPI publicado):

| Operação | NFC-e |
|---|---|
| Criar e enviar nota | A confirmar na pesquisa técnica (`POST /nfce` e envio) |
| Consultar nota | `GET /nfce/{idNotaFiscalConsumidor}` |
| XML | Campo `xml` na consulta; validar com nota real |
| DANFE/PDF | Campos `linkDanfe` e `linkPDF` na consulta; validar disponibilidade |
| Cancelar na SEFAZ | **Sem endpoint público documentado.** `situacao = 2 (Cancelada)` é somente leitura, e `DELETE` remove o registro no Bling sem cancelar na SEFAZ, por isso não deve ser usado |

Para NF-e existe `GET /nfe/documento/{chaveAcesso}?formato=xml|pdf`, que devolve JSON com o arquivo em GZIP + Base64. A validação com uma NFC-e autorizada em homologação é a primeira tarefa da implementação.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configurar o fiscal da empresa e conectar o provedor (Priority: P1)

Como admin da empresa, eu quero completar os dados fiscais da empresa, escolher o provedor de emissão e conectá-lo, para que a empresa possa emitir NFC-e.

**Why this priority**: Pré-requisito de qualquer emissão.

**Independent Test**: Com o endereço já cadastrado na loja, informar CNPJ, IE e razão social, escolher "Bling", concluir o OAuth e ver a configuração "Pronta para emitir" em homologação. Um usuário sem a permissão Fiscal não acessa a tela.

**Acceptance Scenarios**:

1. **Given** a tela Fiscal, **When** aberta, **Then** mostra o endereço do cadastro da loja (somente leitura, com atalho para editar) e aponta campos obrigatórios faltantes (logradouro, número, bairro, cidade, UF, CEP).
2. **Given** a tela Fiscal, **When** o admin informa razão social, CNPJ, IE e regime (Simples Nacional), **Then** os dados são validados (dígitos do CNPJ, IE para a UF do endereço) e salvos por empresa; o código IBGE do município é resolvido a partir de cidade/UF e pode ser corrigido manualmente.
3. **Given** o provedor de plataforma Bling configurado (client id/secret), **When** o admin escolhe "Bling" e clica em conectar, **Then** é feito o OAuth da conta Bling da empresa e os tokens são guardados criptografados, com renovação automática.
4. **Given** um provedor conectado, **When** o admin escolhe o ambiente (homologação ou produção), a série e o modo de emissão (automático ou manual), **Then** a configuração é salva e auditada.
5. **Given** a configuração, **When** consultada, **Then** mostra uma checklist de prontidão: emitente completo, provedor conectado, certificado válido (quando o provedor exigir), ao menos um perfil fiscal padrão, produtos/complementos elegíveis sem perfil e capacidades do provedor (por exemplo, "cancelamento pelo painel do Bling").
6. **Given** a empresa troca de provedor, **When** a troca é confirmada, **Then** as notas já emitidas continuam vinculadas ao provedor antigo (XML e DANFE no storage do ERP) e as novas emissões usam o novo provedor.
7. **Given** um usuário de outra empresa, **When** tenta acessar a configuração ou as notas, **Then** o acesso é bloqueado (isolamento por tenant).

---

### User Story 2 - Perfis fiscais de produtos e complementos (Priority: P1)

Como admin da empresa, eu quero definir perfis tributários e atribuí-los a categorias, produtos e complementos, para que cada item da nota saia com a tributação correta.

**Why this priority**: Sem tributação por item não há nota válida.

**Independent Test**: Criar o perfil "Alimentação preparada" (NCM, CFOP 5102, CSOSN 102, origem 0, unidade UN), atribuí-lo a uma categoria e sobrescrever um produto com o perfil "Bebidas ST" (CSOSN 500, CEST). A prévia da nota de um lanche com "bacon extra" mostra o lanche e o bacon como itens, cada um com o perfil resolvido.

**Acceptance Scenarios**:

1. **Given** a tela de perfis fiscais, **When** o admin cria um perfil com NCM, CFOP, CSOSN, origem, unidade comercial e CEST opcional, **Then** o perfil é validado (formato do NCM, CSOSN permitido no Simples, CEST obrigatório quando o CSOSN exigir) e salvo por empresa.
2. **Given** um produto, **When** o perfil é resolvido, **Then** vale nesta ordem: perfil do produto, depois perfil padrão da categoria.
3. **Given** um complemento pago, **When** o perfil é resolvido, **Then** vale nesta ordem: perfil do complemento, depois o perfil resolvido do produto ao qual foi adicionado.
4. **Given** um item sem perfil resolvido, **When** a emissão é tentada, **Then** a nota não é enviada e fica em pendência "Dados fiscais incompletos", listando os produtos/complementos.
5. **Given** um perfil em uso, **When** o admin tenta excluí-lo, **Then** o sistema impede e mostra onde ele está sendo usado.

---

### User Story 3 - Emitir NFC-e de uma venda (Priority: P1)

Como operador, eu quero que a NFC-e seja emitida automaticamente ao concluir a venda (ou pelo botão "Emitir NFC-e"), para entregar o cupom ao cliente.

**Why this priority**: Objetivo central da feature.

**Independent Test**: No balcão, fechar uma venda com CPF informado. A nota é autorizada em homologação, e o pedido mostra "NFC-e autorizada" com número, série, chave, QR e link do DANFE, com o XML no storage.

**Acceptance Scenarios**:

1. **Given** modo automático e uma venda de balcão/comanda concluída e paga no dia corrente, **When** a venda é finalizada, **Then** a emissão é enfileirada sem bloquear o operador, e o pedido mostra o status fiscal (Processando → Autorizada / Rejeitada / Erro).
2. **Given** modo automático e um pedido Importado/API com data de venda no dia corrente (fuso da empresa), **When** o pedido entra no sistema, **Then** a emissão é enfileirada automaticamente.
3. **Given** um pedido Importado/API com data de venda anterior ao dia corrente, **When** entra no sistema, **Then** não é emitido automaticamente e fica como "Não emitida — emissão manual disponível".
4. **Given** modo manual, ou um pedido fora da regra automática, **When** o operador clica em "Emitir NFC-e" num pedido elegível, **Then** a emissão segue o mesmo fluxo; para venda de dia anterior, o sistema exige confirmação explícita com aviso de risco de rejeição e registra quem confirmou.
5. **Given** a venda, **When** a nota é montada, **Then** inclui um item por produto e um item por complemento pago, os ajustes de preço como desconto rateado, as formas de pagamento mapeadas (inclusive pagamento dividido) e o CPF/CNPJ do consumidor quando informado.
6. **Given** a emissão autorizada, **When** concluída, **Then** o sistema guarda número, série, chave de acesso, protocolo, data de autorização, URL do QR e cópias do XML e do DANFE no storage do ERP.
7. **Given** um pedido com nota autorizada ou em processamento, **When** uma nova emissão é pedida, **Then** o sistema recusa (no máximo uma nota ativa por pedido, com emissão idempotente).
8. **Given** um pedido de origem fora do escopo (cardápio público, iFood) ou com fiscal desativado, **When** consultado, **Then** a opção de emissão não aparece.

---

### User Story 4 - Cancelamento da NFC-e ao cancelar o pedido (Priority: P1)

Como gestor, eu quero que cancelar ou excluir um pedido cancele a NFC-e correspondente, ou me avise com urgência quando o cancelamento precisar ser feito no provedor, para manter a situação fiscal coerente com as vendas.

**Why this priority**: Pedido explícito do usuário; evita nota autorizada de venda que não aconteceu.

**Independent Test**: Com o Bling, cancelar um pedido com nota autorizada. O pedido é cancelado, a nota fica "Cancelamento pendente — cancelar no Bling", aparece uma notificação com o prazo restante e o link da nota no painel. Depois de cancelar no Bling, em poucos minutos a nota aparece "Cancelada" no ERP, com o XML do evento. Com um provedor de teste que suporta cancelamento, o fluxo é automático.

**Acceptance Scenarios**:

1. **Given** um pedido com NFC-e autorizada, **When** o pedido muda para `CANCELLED` ou é excluído, **Then** o sistema inicia o cancelamento da nota com a justificativa (mínimo de 15 caracteres; usa o motivo do pedido ou um padrão).
2. **Given** um provedor com capacidade de cancelamento, **When** o cancelamento é iniciado, **Then** é solicitado ao provedor; se autorizado, a nota fica "Cancelada" com protocolo e XML do evento no storage.
3. **Given** um provedor sem capacidade de cancelamento (Bling), **When** o cancelamento é iniciado, **Then** a nota fica "Cancelamento pendente — ação no provedor", com notificação operacional urgente mostrando o prazo legal restante, a justificativa sugerida e o atalho para a nota no painel do provedor.
4. **Given** uma nota em "Cancelamento pendente", **When** o job de sincronização consulta o provedor e encontra a nota cancelada, **Then** a nota passa a "Cancelada", com XML do evento no storage quando o provedor o fornecer, e a pendência é encerrada.
5. **Given** o prazo legal expirado ou recusa do provedor, **When** o cancelamento não acontece, **Then** o pedido continua cancelado e a nota fica na fila de pendências fiscais como "Cancelamento fora do prazo / recusado", para tratamento manual com o contador.
6. **Given** uma nota ainda em processamento, **When** o pedido é cancelado, **Then** o cancelamento é iniciado assim que a autorização for confirmada; se a nota for rejeitada, nada mais é necessário.
7. **Given** um pedido com nota autorizada, **When** alguém tenta alterar itens ou valores (manutenção de pedido), **Then** a alteração é bloqueada com orientação para cancelar e refazer a venda.
8. **Given** a tela da nota, **When** o usuário com permissão Fiscal pede o cancelamento só da nota, **Then** é possível iniciar o cancelamento da NFC-e com justificativa sem cancelar o pedido.

---

### User Story 5 - Importação automática a cada 2 minutos (Priority: P2)

Como gestor, eu quero que as vendas das integrações sejam importadas automaticamente a cada 2 minutos, para que a NFC-e seja emitida em até 5 minutos após a venda, sem ninguém precisar importar.

**Why this priority**: Viabiliza a meta de 5 minutos para pedidos importados; o balcão não depende disso.

**Independent Test**: Ativar a importação automática do Mercado Pago e do PagBank com atribuição "produto fixo". Fazer uma venda na maquininha e ver o pedido importado e a NFC-e autorizada em até 5 minutos, sem intervenção. Simular o provedor fora do ar e ver os ciclos falharem com log estruturado, sem travar os outros provedores nem as outras empresas, e retomarem sozinhos.

**Acceptance Scenarios**:

1. **Given** uma integração de vendas ativa do **Mercado Pago ou do PagBank**, **When** o admin liga "Importação automática" e define a regra de atribuição de produtos (automática por valor ou produto fixo), **Then** a configuração é salva e auditada.
2. **Given** a importação automática ligada, **When** o job roda (a cada 2 minutos), **Then** busca as vendas recentes do dia, cria os pedidos novos sem a etapa de prévia, aplicando a atribuição configurada e a deduplicação existente, e registra a execução no histórico com o gatilho "Automático".
3. **Given** uma execução anterior ainda em andamento ou o lock da integração ocupado, **When** o job dispara, **Then** pula o ciclo, sem sobreposição.
4. **Given** uma venda que a atribuição automática não consegue resolver, **When** importada, **Then** não cria pedido e a registra para revisão manual na tela de importação.
5. **Given** uma falha num ciclo (timeout, erro HTTP, token expirado, limite de requisições), **When** ocorre, **Then** o ciclo termina sem afetar as outras integrações e empresas, registra um log estruturado (empresa, integração, provedor, ciclo, código do erro, duração, tentativa) e o próximo ciclo tenta de novo cobrindo a janela não importada (sem perder vendas).
6. **Given** falhas consecutivas acima de um limite, ou um atraso de dados acima do esperado (diferença entre a última venda importada e o horário atual), **When** detectado, **Then** o sistema emite um log de alerta e uma notificação operacional para a empresa, e a integração mostra o status "Importação automática com falhas".
7. **Given** um provedor que entrega as vendas com atraso (por exemplo, extrato com defasagem), **When** a importação roda, **Then** importa o que estiver disponível e registra a defasagem observada em log/métrica. As vendas que chegarem depois do dia da venda seguem a regra de emissão manual.

---

### User Story 6 - Certificado A1 (Priority: P2)

> **Adiada (decisão de 2026-10-30).** O Bling assina a NFC-e com o certificado A1 cadastrado na própria conta, então a emissão não depende desta história. A implementação aguarda uma versão madura do `node-forge` (as versões ≤ 1.4.0 têm vulnerabilidades altas no ASN.1; a 1.4.2 corrigida saiu em 2026-10-27). Reavaliar em algumas semanas.

Como admin da empresa, eu quero enviar o certificado A1 e ser avisado antes do vencimento, para não parar de emitir.

**Why this priority**: O Bling usa o certificado da própria conta, então para o primeiro provedor isso é controle e alerta. Para provedores futuros o certificado será obrigatório.

**Independent Test**: Enviar um .pfx com a senha. O sistema mostra titular, CNPJ e validade, e alerta se o CNPJ não bate com o do emitente. Com o vencimento em menos de 30 dias, aparece uma notificação operacional.

**Acceptance Scenarios**:

1. **Given** o upload do .pfx e da senha, **When** validado, **Then** o arquivo e a senha são guardados criptografados por empresa, e só os metadados (titular, CNPJ, emissão, validade, fingerprint) ficam legíveis.
2. **Given** senha incorreta, arquivo inválido ou certificado vencido, **When** o upload é feito, **Then** é recusado com o motivo.
3. **Given** um certificado ativo, **When** faltarem 30, 15, 7 e 1 dias para o vencimento, **Then** é gerada uma notificação operacional; após o vencimento, a prontidão indica bloqueio para provedores que exigem certificado.
4. **Given** um novo certificado, **When** enviado, **Then** substitui o anterior (rotação auditada), sem expor o arquivo nem a senha em nenhuma API.

---

### User Story 7 - Controle fiscal nas vendas e pendências (Priority: P2)

Como gestor, eu quero ver a situação fiscal de cada venda e uma fila de pendências, para garantir que nenhuma venda fique sem nota ou com nota irregular.

**Why this priority**: Pedido explícito ("controle nas vendas da NFC emitida").

**Independent Test**: A lista de pedidos filtra por status fiscal. A tela de pendências mostra as rejeitadas, os erros, os cancelamentos pendentes e as vendas do dia sem nota, com ação de reprocessar.

**Acceptance Scenarios**:

1. **Given** a lista e o detalhe de pedidos, **When** exibidos, **Then** mostram o status fiscal (Não emitida, Processando, Autorizada, Rejeitada, Erro, Cancelada, Cancelamento pendente, Não aplicável) e permitem filtrar por ele.
2. **Given** uma rejeição da SEFAZ, **When** registrada, **Then** aparece na fila com código e mensagem; depois de corrigir (por exemplo, o perfil fiscal), o usuário reemite.
3. **Given** uma falha técnica (provedor fora, timeout), **When** ocorre, **Then** a emissão é reprocessada em background com backoff; esgotadas as tentativas, vai para a fila.
4. **Given** um timeout com resultado incerto, **When** reprocessado, **Then** o sistema consulta o provedor antes de reenviar, para não gerar nota duplicada.
5. **Given** qualquer emissão, cancelamento ou reprocessamento, **When** consultada a auditoria, **Then** aparecem o usuário (ou "automático"), a data, o provedor e o resultado.

---

### User Story 8 - Entrega do DANFE e XML para o contador (Priority: P3)

Como operador, eu quero imprimir o cupom ou enviá-lo por WhatsApp, e como gestor eu quero exportar os XMLs do período para o contador.

**Why this priority**: Complementa a emissão; a nota é válida mesmo sem estes canais.

**Independent Test**: No pedido autorizado, abrir o DANFE para impressão e copiar o link do WhatsApp com a consulta da nota. Exportar outubro e receber um ZIP com os XMLs autorizados e cancelados e um resumo.

**Acceptance Scenarios**:

1. **Given** uma nota autorizada, **When** o operador clica em "Imprimir", **Then** o DANFE NFC-e abre em formato adequado para impressão no navegador/térmica.
2. **Given** o link de WhatsApp do pedido, **When** gerado para pedido com nota autorizada, **Then** inclui o link de consulta da NFC-e.
3. **Given** um período, **When** o gestor exporta, **Then** um job gera um ZIP com os XMLs (autorizações e eventos de cancelamento) e um CSV resumo (número, série, chave, data, valor, status), usando a infraestrutura de exportação existente.

---

### Edge Cases

- Pedido com pagamento dividido entre formas diferentes (`PaymentAllocation`): a nota lista cada forma com seu valor.
- Venda de valor zero, ou 100% de desconto: não emite e fica marcada como "Não aplicável".
- Complemento gratuito (sem acréscimo de preço) e remoção de ingrediente: não viram item da nota; podem aparecer na descrição do item principal.
- Ajuste manual de preço negativo no item (`manualAdjustmentAmount`): vira desconto do item. Ajuste positivo compõe o valor unitário do item.
- Venda importada perto da meia-noite: a regra "do dia" usa a data da venda no fuso da empresa, não a data da importação.
- Cancelamento no Bling feito depois do prazo legal (SP): o Bling/SEFAZ recusa; a pendência continua até o tratamento manual.
- Pedido cancelado antes de concluída a emissão automática: a emissão não é enviada.
- Token do Bling expirado ou revogado: a emissão vai para pendência "Provedor desconectado" e a prontidão alerta.
- Troca de ambiente de homologação para produção com notas de homologação existentes: essas notas ficam marcadas e nunca são exportadas ao contador.
- CNPJ do certificado diferente do CNPJ do emitente: aviso na prontidão e bloqueio para provedores que usam o certificado.
- Endereço da loja alterado depois de notas emitidas: as notas antigas mantêm o snapshot do emitente no XML guardado.
- Pedido excluído (soft delete) com nota cancelada: a nota continua consultável e exportável.
- Duas pessoas pedindo a emissão do mesmo pedido ao mesmo tempo: só uma nota é criada (idempotência e lock).

## Requirements *(mandatory)*

### Functional Requirements

**Configuração e provedores**

- **FR-001**: O sistema DEVE manter por empresa uma configuração fiscal: ativo/inativo, provedor, ambiente (homologação/produção), série, modo de emissão (automático/manual), origens elegíveis (nesta fase: balcão/comanda, importados, API) e justificativa padrão de cancelamento.
- **FR-002**: Os dados do emitente DEVEM vir do **cadastro da loja** (fonte única): endereço, razão social, nome fantasia, CNPJ, IE, regime tributário (Simples Nacional/MEI) e código IBGE do município (resolvido por cidade/UF, editável).
- **FR-002a**: Usuários de plataforma DEVEM poder incluir, alterar (todos os campos) e desativar lojas. O admin da loja (dono, admin ou permissão "Dados da loja") DEVE poder ver e alterar somente a própria loja: nome, telefone, endereço, redes sociais e dados fiscais; slug, domínio público e ativação ficam restritos à plataforma. Alterações são auditadas.
- **FR-003**: A emissão DEVE passar por um contrato único de provedor fiscal (emitir, consultar, cancelar, obter XML/DANFE, validar conexão) com **capacidades declaradas** por provedor (por exemplo, `cancelamentoViaApi`, `usaCertificadoProprio`), e adapters registrados. O primeiro adapter é o Bling.
- **FR-004**: As credenciais do app Bling (client id/secret) DEVEM ficar na configuração de plataforma; cada empresa conecta sua conta via OAuth2, com tokens criptografados e renovação automática.
- **FR-005**: Configurar o fiscal DEVE exigir a nova permissão Fiscal com ações separadas: visualizar, configurar, emitir e cancelar.

**Certificado A1**

- **FR-006**: O sistema DEVE aceitar o upload de certificado A1 (.pfx/.p12) com senha, validar senha e validade, extrair titular, CNPJ, datas e fingerprint, e guardar arquivo e senha criptografados.
- **FR-007**: O arquivo e a senha do certificado NUNCA DEVEM ser devolvidos por nenhuma API nem aparecer em logs.
- **FR-008**: O sistema DEVE gerar notificações operacionais de vencimento do certificado (30, 15, 7 e 1 dias) e refletir certificado ausente ou vencido na prontidão.

**Tributação**

- **FR-009**: O sistema DEVE permitir CRUD de perfis fiscais por empresa (NCM, CFOP, CSOSN, origem da mercadoria, unidade comercial, CEST opcional), com validação de formato e de CSOSN permitido no Simples Nacional.
- **FR-010**: O perfil fiscal DEVE ser resolvido assim: produto → categoria; complemento → complemento → perfil resolvido do produto pai. Sem perfil, a emissão é bloqueada com pendência.

**Emissão**

- **FR-011**: No modo automático, o sistema DEVE enfileirar a emissão de vendas elegíveis concluídas e pagas **cuja data de venda seja o dia corrente** no fuso da empresa, sem bloquear o operador.
- **FR-012**: Pedidos fora da regra automática DEVEM ficar disponíveis para emissão manual; a emissão de venda de dia anterior exige confirmação explícita com aviso de risco e é auditada.
- **FR-013**: O sistema DEVE garantir no máximo uma NFC-e ativa (processando ou autorizada) por venda, com idempotência e lock contra concorrência. A unidade de venda é o pedido avulso (balcão, importado, API) ou a **comanda inteira** (uma nota com os itens de todos os pedidos não cancelados, porque a comanda é paga de uma vez).
- **FR-014**: O sistema DEVE mapear as formas de pagamento do pedido (`PaymentMethod` e alocações) para os meios de pagamento da NFC-e, incluindo pagamento dividido e troco.
- **FR-015**: O sistema DEVE aceitar CPF/CNPJ opcional do consumidor no fechamento de venda de balcão/comanda, validar o dígito e enviá-lo na nota.
- **FR-016**: O sistema DEVE guardar, por nota: pedido, provedor, ambiente, ids externos, número, série, chave, protocolo, status, datas, código/mensagem de rejeição, URL do QR/consulta, snapshot do emitente, e cópias de XML e DANFE no storage do ERP.

**Cancelamento e alterações**

- **FR-017**: Mudar o pedido para `CANCELLED` ou excluí-lo DEVE iniciar o cancelamento da NFC-e autorizada, com justificativa de no mínimo 15 caracteres.
- **FR-018**: Com provedor sem `cancelamentoViaApi`, o cancelamento DEVE ser assistido: a nota fica "Cancelamento pendente — ação no provedor", com notificação urgente contendo prazo legal restante, justificativa sugerida e atalho para a nota no painel do provedor.
- **FR-019**: Um job de sincronização DEVE consultar o provedor periodicamente para notas em processamento e em cancelamento pendente, atualizando o status (inclusive cancelamento feito direto no provedor) e guardando o XML do evento quando disponível.
- **FR-020**: Falha ou impossibilidade de cancelamento NÃO DEVE impedir o cancelamento do pedido; a nota permanece na fila de pendências até a resolução.
- **FR-021**: Alterar itens ou valores de pedido com NFC-e autorizada DEVE ser bloqueado.
- **FR-022**: Usuários com permissão Fiscal/cancelar DEVEM poder iniciar o cancelamento de uma NFC-e sem cancelar o pedido.

**Composição da nota**

- **FR-023**: Cada produto do pedido DEVE gerar um item da nota; cada complemento pago (`ADD_COMPLEMENT` com acréscimo de preço) DEVE gerar um item próprio, com o perfil fiscal resolvido pelo FR-010. Complementos gratuitos e remoções de ingredientes não geram item.
- **FR-024**: Ajustes negativos de preço DEVEM ser lançados como desconto do item. Descontos e acréscimos no nível do pedido, quando existirem, DEVEM ser rateados proporcionalmente entre os itens.
- **FR-025**: Taxa de entrega, quando existir no pedido, DEVE ser rateada no frete dos itens. Taxa de serviço/gorjeta, quando existir, DEVE seguir a RC SEFAZ-SP 33566/2026 (item separado, CFOP 5.949, NCM 99, cBenef). A tributação equivalente no Simples Nacional deve ser validada com o contador antes de ativar.

**Importação automática**

- **FR-026**: O sistema DEVE permitir ligar, por integração de vendas, a importação automática a cada 2 minutos, com regra de atribuição de produtos configurada, sem prévia, reaproveitando a deduplicação, o lock de operação e o histórico de importações existentes (novo gatilho "Automático").
- **FR-027**: A importação automática DEVE estar disponível para Mercado Pago e PagBank. Vendas sem atribuição resolvida não geram pedido e ficam para revisão manual.
- **FR-027a**: A importação automática DEVE ser resiliente: isolamento por integração/empresa, janela de busca com sobreposição a partir do último cursor confirmado (sem lacunas, com deduplicação), backoff em erros transitórios e respeito a limites de requisição.
- **FR-027b**: Cada ciclo DEVE gerar logs estruturados com evento estável (`sales.auto_import.cycle` com resultado `success|skipped|failed`), empresa, integração, provedor, duração, vendas encontradas/criadas/duplicadas, código do erro e defasagem dos dados. Falhas consecutivas acima do limite e defasagem acima do limite DEVEM gerar log de alerta (`sales.auto_import.degraded`) e notificação operacional, para servir de base à monitoria.
- **FR-027c**: Os jobs fiscais (emissão, sincronização, cancelamento) DEVEM seguir o mesmo padrão de logs (`fiscal.document.*`), incluindo tempo entre a venda e a autorização, para medir a meta de 5 minutos.

**Operação e controle**

- **FR-028**: Falhas técnicas DEVEM ser reprocessadas em background com backoff e limite de tentativas; resultado incerto exige consulta ao provedor antes de reenviar.
- **FR-029**: O sistema DEVE oferecer uma fila de pendências fiscais (rejeitadas, erros, cancelamento pendente, cancelamento fora do prazo, dados incompletos, provedor desconectado) com ação de reprocessar.
- **FR-030**: Lista e detalhe de pedidos DEVEM mostrar e filtrar pelo status fiscal.
- **FR-031**: O sistema DEVE oferecer DANFE para impressão, link de consulta no WhatsApp do pedido e exportação em lote (ZIP de XMLs + CSV resumo) por período, excluindo notas de homologação.
- **FR-032**: Emissões, cancelamentos, reprocessamentos, mudanças de configuração e de certificado DEVEM ser auditados (usuário ou "automático", provedor, resultado) com logs estruturados, sem dados sensíveis.
- **FR-033**: Todos os dados fiscais DEVEM ter `tenant_id`, e o acesso entre empresas DEVE ser bloqueado e testado.

### Key Entities

- **FiscalConfiguration** (por empresa): ativo, provedor, ambiente, série, modo de emissão, origens elegíveis, justificativa padrão de cancelamento.
- **Tenant (loja), campos novos**: razão social, nome fantasia, CNPJ, IE, regime tributário e código IBGE; o endereço continua no perfil da loja.
- **FiscalProviderConnection**: conexão da empresa com um provedor (status, tokens criptografados, expiração, último erro); segue o padrão de `SalesIntegration`/`SalesIntegrationCredential`.
- **FiscalCertificate**: arquivo e senha criptografados, mais metadados (titular, CNPJ, validade, fingerprint, status ativo/substituído).
- **FiscalProfile**: perfil tributário (NCM, CFOP, CSOSN, origem, unidade, CEST); referenciado por `Category` (padrão), `Product` e `ProductComplement` (sobrescrita).
- **FiscalDocument**: a NFC-e de um pedido (status, numeração, chave, protocolo, ids do provedor, ambiente, snapshot do emitente, referências de XML/DANFE no storage, consumidor identificado, prazo de cancelamento).
- **FiscalDocumentEvent**: histórico de cada tentativa e evento (emissão, consulta, cancelamento, sincronização, rejeição, retry) com payloads sanitizados.
- **SalesIntegration (extensão)**: importação automática ligada/desligada e regra de atribuição padrão.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em homologação, uma venda de balcão concluída tem a NFC-e autorizada e visível no pedido em até 30 segundos em 95% dos casos, com o provedor disponível.
- **SC-002**: Com a importação automática ligada, 95% das vendas importadas do dia têm a NFC-e autorizada em até 5 minutos após a venda.
- **SC-003**: 100% dos pedidos cancelados com nota autorizada terminam com a nota cancelada ou com pendência visível e notificada em até 1 minuto. Nenhum fica com nota autorizada sem sinalização.
- **SC-004**: Um cancelamento feito no painel do Bling aparece no ERP em até 5 minutos.
- **SC-005**: Zero notas duplicadas para o mesmo pedido em testes de concorrência e de timeout.
- **SC-006**: Um admin configura o fiscal (emitente, Bling, perfis) e emite a primeira nota de homologação em menos de 20 minutos, guiado pela checklist de prontidão.
- **SC-007**: Trocar de provedor não exige mudança no fluxo de vendas, e as notas anteriores continuam consultáveis e exportáveis.

## Assumptions

- A conta Bling da empresa já está habilitada para NFC-e em SP (certificado A1, CSC/token e série cadastrados no Bling). O ERP não envia certificado nem CSC ao Bling.
- A criação e o envio de NFC-e pela API v3 do Bling, o conteúdo do campo `xml` e os links de DANFE precisam ser validados com uma nota real em homologação (primeira tarefa). Também é preciso confirmar se a NFC-e aceita os itens com dados fiscais na própria requisição ou exige produtos cadastrados no Bling.
- O cancelamento de NFC-e no Bling é feito pelo painel até o fornecedor oferecer uma alternativa oficial. Quando houver, basta o adapter declarar `cancelamentoViaApi`.
- O prazo legal de cancelamento da NFC-e em SP precisa ser confirmado na pesquisa técnica; ele alimenta o contador de prazo das notificações.
- A importação automática roda para Mercado Pago e PagBank. Se a API do PagBank (EDI) entregar as vendas com defasagem, a meta de 5 minutos fica limitada a essa defasagem; isso é medido em log, não bloqueia a feature.
- A numeração da NFC-e é controlada pelo provedor; o ERP só registra o resultado.
- O piloto opera no Simples Nacional em SP; outros regimes e UFs ficam para specs futuras, mas o modelo não deve impedi-los.
- Fora de escopo: NF-e (modelo 55), contingência offline, cardápio público e iFood como origens, inutilização de numeração, carta de correção, devolução, regimes não-Simples, e cancelamento por `DELETE` no Bling (que remove o registro sem cancelar na SEFAZ).
- Reaproveitamento: `IntegrationSecretService` (criptografia), jobs em background, storage de assets, exportação, notificações operacionais, perfil da loja (`config.address`), lock de operação e histórico de importação, e o padrão de configuração de plataforma (Mercado Pago/PagBank).
