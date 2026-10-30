# Research: Módulo Fiscal — NFC-e

## R1. Bling API v3 para NFC-e

**Decisão**: o adapter Bling usa o fluxo em duas etapas: criar a NFC-e (gera o `id` no Bling) e depois enviar para a SEFAZ. O `id` externo é gravado **antes** do envio, então retentar o envio nunca cria uma segunda nota.

| Item | Situação | Ação |
|---|---|---|
| OAuth2 | Authorization code; o access token expira em horas e é renovado com o refresh token (Basic `client_id:client_secret`) | Reaproveitar o padrão do Mercado Pago OAuth (state assinado, callback, refresh agendado) |
| Criar NFC-e | `POST /nfce` (a validar) | **T001**: validar em homologação o payload mínimo e se aceita itens com NCM/CFOP/origem inline ou exige `produto.id` |
| Enviar à SEFAZ | `POST /nfce/{id}/enviar` (a validar) | T001 |
| Consultar | `GET /nfce/{idNotaFiscalConsumidor}`: `situacao`, `numero`, `serie`, `chaveAcesso`, `xml`, `linkDanfe`, `linkPDF` | T001: confirmar o conteúdo de `xml` (URL ou conteúdo) e os links |
| Listar | `GET /nfce` com filtros de data/situação (a validar) | Usado na recuperação de timeout antes de ter o `id` |
| Cancelar | **Sem endpoint público.** `situacao=2` é somente leitura; `DELETE` remove o registro sem cancelar na SEFAZ | Capacidade `cancelViaApi = false` → cancelamento assistido (FR-018) |
| Download NF-e | `GET /nfe/documento/{chave}?formato=xml\|pdf` → JSON `data[].conteudo` em GZIP + Base64 | Implementar o decodificador genérico; testar se serve para NFC-e |
| Limites | Limite de requisições por segundo e por dia (a confirmar; documentação cita ~3 req/s) | Fila por empresa com concorrência 1 para Bling; backoff em 429 |

**Validação com a conta real (T001, 2026-10-30, leitura apenas)**:

- OAuth ok: `POST /oauth/token` com Basic `client_id:client_secret` devolve `access_token`, `refresh_token`, `expires_in=21600` (6 h), `token_type`, `scope`. O app atual foi criado com um único escopo.
- `GET /nfce?pagina=1&limite=5` → 200 (lista vazia; nenhuma NFC-e emitida ainda).
- `GET /formas-pagamentos` → 200, 7 formas. O campo `tipoPagamento` **é o código tPag** (Dinheiro=1, Pix=20, Boleto=15, Cheque=2, Depósito=16, Crediário/Vale-Troca=21). O mapeamento `PaymentMethod → forma do Bling` pode ser **sugerido automaticamente** pelo tPag da tabela R4.
- Faltam na conta formas para Cartão de crédito (3), Cartão de débito (4), Vale-refeição (11) e Pix dinâmico (17). Elas precisam ser cadastradas no Bling antes de emitir vendas pagas com esses meios; a prontidão já bloqueia sem o mapeamento.
- `GET /naturezas-operacoes` → 400 "Permissão negada" e `GET /empresas/me/dados-basicos` → 403 `insufficient_scope`: o app precisa dos escopos de Naturezas de Operação (e, opcionalmente, dados da empresa para conferir o CNPJ). Reconectar depois de incluir os escopos.
- Depois de incluir escopos no app e reconectar (token com 25 escopos): `GET /naturezas-operacoes` → 200 (18 naturezas, campos `id, situacao, padrao, descricao`) e `GET /empresas/me/dados-basicos` → 200 (`id, nome, cnpj, email, dataContrato`). A natureza indicada para NFC-e é "Venda de mercadoria a não contribuinte" (`padrao = 1`), que o adapter sugere por padrão. O CNPJ da conta Bling será comparado com o CNPJ do emitente na prontidão.

**Primeira NFC-e de teste em homologação (2026-10-30)** — contrato OpenAPI oficial (`developer.bling.com.br/build/assets/openapi-*.json`) e chamadas reais:

- `POST /nfce` → 201 `{ id, numero, serie, contato }`. **Itens sem cadastro prévio funcionam** (`codigo`, `descricao`, `unidade`, `quantidade`, `valor`, `tipo: "P"`, `classificacaoFiscal` = NCM, `origem`, `cfop`, `cest`). `numero` pode ser omitido (o Bling atribui: 000001, série 1). Consumidor não identificado: `contato { nome: "Consumidor final", tipoPessoa: "F", numeroDocumento: "", contribuinte: 9 }`. Pagamentos em `parcelas[{ data, valor, formaPagamento.id }]`.
- Não há desconto/despesa por item no contrato: só `desconto` e `despesas` no total da nota. O adapter envia a soma dos descontos/acréscimos do compositor.
- O Bling calcula os tributos (CSOSN, IBPT) pela natureza de operação e pelo regime da conta: o XML saiu com `CRT=1`, `CSOSN=102`, `vTotTrib` preenchido.
- `POST /nfce/{id}/enviar` → 200 `{ data: { xml } }` com o **retorno SOAP da SEFAZ** (`retEnviNFe`: `tpAmb`, `cStat` do lote 104 e `protNFe` com `cStat`/`xMotivo`/`chNFe`/`nProt`). É síncrono: o adapter lê o `protNFe` na própria resposta.
- `GET /nfce/{id}` depois do envio: `situacao` (1 Pendente, 2 Cancelada, 3 Aguardando recibo, 4 Rejeitada, 5 Autorizada, 6 Emitida DANFE, 7 Registrada, 8 Aguardando protocolo, 9 Denegada, 10 Consulta situação, 11 Bloqueada), `chaveAcesso`, **`xml` é uma URL assinada** para baixar o XML, `linkDanfe`/`linkPDF` são URLs. `observacoes` não volta na consulta.
- `GET /nfce` filtra por `numero`, `serie`, `chaveAcesso`, `situacao`, `dataEmissaoInicial/Final`: `findByReference` busca pela janela de emissão e confere valor e códigos dos itens.
- Resultado do teste: **rejeição 717** ("NFC-e ou NF-e com DANFE Simplificado Tipo 2 em operação não permitida"). Causa no XML: `indPres = 9` (não presencial). NFC-e exige `indPres` 1 (presencial) ou 4 (entrega em domicílio). O contrato não tem campo de presença: vem da configuração da natureza de operação no Bling. Todo o resto do XML estava correto (`mod 65`, `tpAmb 2`, `indFinal 1`, `idDest 1`, `CFOP 5102`, `tPag 01`).
- Mapeamento de situação no adapter: 1/3/8/10 → PROCESSING; 5/6/7 → AUTHORIZED; 4/9/11 → REJECTED (motivo do `protNFe`); 2 → CANCELLED.

**Segunda rodada (2026-10-30)**: com "Indicador de presença = 1 - Operação presencial" na natureza, o reenvio da nota 000001 continuou com `indPres = 9`: **o Bling grava os indicadores na nota ao criá-la**, então mudanças na natureza só valem para notas novas (uma nota rejeitada por configuração precisa ser recriada). A nota nova 000002 saiu com `indPres = 1` e passou da regra 717, mas foi rejeitada com **180** ("Código Regime Tributário do emitente diverge do cadastro na Receita Federal"): o XML levou `CRT = 1` (Simples Nacional), que não corresponde ao regime do CNPJ na Receita. O CRT vem do "Código de regime tributário" da natureza/conta no Bling e precisa refletir o regime real (1 Simples, 2 Simples com excesso de sublimite, 3 Regime normal, 4 MEI).

**Terceira rodada — primeira NFC-e autorizada (2026-10-30)**:

- Regime: a consulta do Simples Nacional mostra a empresa **enquadrada no SIMEI desde 24/04/2026**, com desenquadramento agendado para **01/11/2026** ("Natureza jurídica vedada"). Até 31/10/2026 o CRT correto é 4 (MEI); a partir de 01/11/2026 passa a ser 1 (Simples Nacional). No Bling, a natureza de produção precisa acompanhar a data. O Bling avisa que uma natureza com regime diferente do cadastro "não será listada para emissão", mas a API aceita o id.
- Natureza sem **"Faturada"** faz o Bling incluir um `detPag` com `tPag 90` (sem pagamento) e `vPag 0` ao lado do pagamento real → **rejeição 899**. A natureza de NFC-e precisa: Saída, Faturada, Consumidor final, Indicador de presença 1 e o regime do CNPJ. A prontidão vai orientar esses quatro pontos.
- Nota 000004: **autorizada** (`cStat 100`, protocolo `135260000240600xx`, `tpAmb 2`). `GET /nfce/{id}` → `situacao 5`, `chaveAcesso` e `xml` (URL assinada, sem autenticação) com o **`nfeProc` completo** (NFe + `protNFe`), de onde saem `qrCode` e `urlChave` (consulta pública da SEFAZ-SP).
- `linkDanfe` e `linkPDF` devolvem a **mesma página HTML** "DANFE NFCe" (formato bobina, com QR Code e `window.print()`), pública. **Não há PDF**: o ERP guarda o XML no storage (documento fiscal) e usa o `linkDanfe` para imprimir e compartilhar. `downloadDanfe` do adapter devolve `null` e a rota de DANFE redireciona para o link.

**Quarta rodada — adapter real (2026-10-30)**: o `BlingFiscalProviderAdapter` emitiu a nota 000005 em homologação (autorizada, `cStat 100`) com 2 itens, desconto, acréscimo e pagamento dividido Pix + dinheiro com troco. Comportamentos do Bling incorporados:

- `desconto`/`despesas` da nota são **rateados pelo Bling** entre os itens (`vDesc` 0,38 + 0,12 em vez de 0,50 no primeiro item). O total (`vNF`) bate; no MEI/Simples com CSOSN 102 não há efeito tributário.
- O troco não é enviado: a parcela em dinheiro vai com o valor líquido (`vPag` 2,00 de 5,00 recebidos com 3,00 de troco), e a soma dos pagamentos = `vNF`.
- A forma de pagamento com tipo 17 (Pix dinâmico) sai como `tPag 20`, e duas parcelas geram `indPag = 1`. A SEFAZ aceitou os dois.
- `GET /nfce` (lista) **não traz `valorNota`**: `findByReference` compara total e códigos dos itens no detalhe de cada candidato da janela de 30 minutos.

**Riscos identificados**:

1. **Tributação no Bling.** O Bling calcula tributos pela *natureza de operação* e pelas regras de tributação da conta. Se a API ignorar o CSOSN/CFOP inline, os perfis fiscais do ERP continuam sendo a fonte para os provedores futuros e para a validação, mas no Bling a tributação efetiva vem da natureza de operação. Mitigação: configurar `naturezaOperacaoId` por empresa no adapter, e a T001 compara o XML autorizado com o perfil enviado.
2. **Formas de pagamento.** No Bling, as parcelas referenciam formas de pagamento cadastradas na conta (`formaPagamento.id`). Mitigação: tela de mapeamento `PaymentMethod → forma do Bling` (lista via `GET /formas-pagamentos`), guardada nas configurações da conexão; a prontidão exige o mapeamento completo.
3. **Produtos.** Teste do usuário na interface do Bling (2026-10-30): a NFC-e aceita item sem cadastro prévio, marcado como "Produto novo", com código, unidade, quantidade, preço e NCM. O adapter envia os itens inline (código = id do produto/complemento do ERP), sem sincronizar catálogo. A T001 confirma o mesmo comportamento na API; se ela exigir `produto.id`, o plano B é upsert por código com cache de `externalProductId`.

**Alternativas consideradas**: emitir direto na SEFAZ (exigiria assinatura XML, CSC, contingência e homologação própria; descartado para a fase 1). Focus NFe, PlugNotas e NFe.io têm cancelamento via API e aceitam o A1 por upload; ficam como candidatos de segundo adapter, e o contrato já prevê `usesOwnCertificate`.

## R2. Prazo de cancelamento em SP

**Decisão**: 30 minutos após a autorização (prazo informado pela SEFAZ-SP), em uma tabela por UF (`SP: 30`, padrão 30) usada para o contador das notificações. O ERP não bloqueia o cancelamento pelo prazo; tenta e trata a recusa.

O **cancelamento por substituição** (até 168 h, usado quando uma nota em contingência substitui outra) fica fora do escopo, junto com a contingência.

Fontes: [Oobj — cancelamento NFC-e](https://oobj.com.br/legislacao/cancelamento-nfce/), [Senior — cancelamento por substituição](https://documentacao.senior.com.br/documentoseletronicos/5.8.16/html_ajuda/documentacaoprocesso/nfc-e/cancelamento-substituicao.htm).

**Consequência para o Bling**: com cancelamento manual e janela de 30 minutos, a notificação precisa ser imediata e insistente: notificação de severidade ERROR para quem tem `fiscal.cancel`, destaque na tela de pedidos e lembrete aos 10 minutos restantes.

## R3. Composição dos itens

**Decisão**: um item por `OrderItem` e um item por `OrderItemModification` do tipo `ADD_COMPLEMENT` com `totalPriceDelta > 0`. O valor do item principal é `chargedUnitPrice` (ou `unitPrice`) menos o acréscimo dos complementos já incluído no preço. O ajuste manual negativo vira `vDesc` do item. A soma dos itens deve bater com `order.total` ao centavo; a diferença de arredondamento vai para o último item.

Gorjeta (SP, RC 33566/2026) e taxa de entrega (frete rateado) ficam implementadas no compositor, mas inativas: hoje o pedido não tem esses campos. Ver a seção Pesquisa do spec.

**Comanda (decisão de desenho)**: a comanda (`ServiceTab`) é paga de uma vez e pode receber pagamentos na própria comanda. Por isso **a unidade fiscal da comanda é a comanda inteira**: uma NFC-e com os itens de todos os pedidos não cancelados dela. Balcão avulso, importados e API emitem uma NFC-e por pedido. O `FiscalDocument` aponta para `orderId` **ou** `serviceTabId`.

## R4. Meios de pagamento (tPag)

| `PaymentMethod` | tPag NFC-e |
|---|---|
| CASH | 01 Dinheiro (com troco quando houver) |
| CREDIT_CARD | 03 Cartão de crédito (`tpIntegra=2`, não integrado) |
| DEBIT_CARD | 04 Cartão de débito (`tpIntegra=2`) |
| VOUCHER | 11 Vale refeição |
| PIX | 17 PIX dinâmico |
| PIX_MANUAL | 20 PIX estático |
| DIGITAL_WALLET | 18 Transferência / carteira digital |
| CARD_ON_DELIVERY | 99 Outros, com descrição (não ocorre nas origens desta fase) |

Fonte primária dos valores: `PaymentAllocation` de pagamentos não cancelados/estornados. Sem alocação (importados/API), usa `order.paymentMethod` com o valor total. No Bling, o código tPag é resolvido pela forma de pagamento mapeada (R1, risco 2).

## R5. Certificado A1

**Decisão**: `node-forge` (nova dependência, puro JS) para abrir o PKCS#12 com a senha e extrair titular, CNPJ (OID ICP-Brasil 2.16.76.1.3.3 ou CN `NOME:CNPJ`), validade e fingerprint SHA-256. O `crypto` nativo do Node não lê metadados de PFX. Arquivo (Base64) e senha ficam num envelope `FISCAL_A1_CERTIFICATE` do `IntegrationSecretService` (AES-256-GCM). Limite de upload: 20 KB.

## R6. Código IBGE do município

**Decisão**: resolver pela API pública do IBGE (`servicodados.ibge.gov.br/api/v1/localidades/estados/{UF}/municipios`), comparando o nome normalizado (sem acento, minúsculo) com a cidade do perfil da loja. O código é gravado no emitente e pode ser editado; se a API falhar, o campo fica manual. Não embarcamos a tabela de ~5.570 municípios.

## R7. Importação automática

**Decisão**: novo job `SALES_AUTO_IMPORT` disparado a cada 2 minutos por integração com `autoImportEnabled`. Ele cria um `SalesImportRun` com o novo gatilho `AUTOMATIC` para o dia corrente (e também o dia anterior nos primeiros 10 minutos após a meia-noite) e roda a prévia e a confirmação no mesmo job, com a estratégia configurada. Funciona sobre o fluxo atual porque:

- `isDateBlockedForProvider` só bloqueia datas futuras: o dia corrente é aceito.
- A deduplicação por `ExternalSaleIdentity.claim` torna ciclos repetidos idempotentes.
- O lock de operação por integração já existe.

**Resiliência**:
- Dedupe do job por integração, sem sobreposição.
- Erros do provedor classificados por `SalesProviderError.code`, com backoff exponencial quando `RATE_LIMIT`/`UNAVAILABLE`.
- Isolamento: cada integração é um job.
- Contadores `autoImportConsecutiveFailures` e `autoImportLastSuccessAt` na integração.
- Alerta (`sales.auto_import.degraded`) com 3 ou mais falhas seguidas ou defasagem maior que 15 minutos, limitado a uma notificação por hora por integração.

**PagBank**: o EDI `movement/{v}/transactional/{data}` provavelmente entrega com defasagem. A defasagem observada (`now - max(occurredAt)`) vai para o log de cada ciclo; se for estrutural, as vendas caem na emissão manual (dia anterior) sem quebrar nada.

## R8. Gatilho de emissão automática

**Decisão**: hooks explícitos e uma varredura de segurança.

- **Hooks** chamam `FiscalTriggerService.requestAutomatic(target)` depois do commit:
  - confirmação de pagamento manual;
  - liquidação Point;
  - comanda paga;
  - criação de pedido importado/API.
  Cada hook enfileira `FISCAL_EMISSION` com `dedupeKey` do alvo. Isso cobre a meta de 30 segundos.
- **Varredura** a cada minuto: alvos do dia, elegíveis, pagos, sem documento ativo, em empresas no modo automático. Ela garante a emissão mesmo se um hook falhar e loga `fiscal.trigger.recovered` quando encontra algo.

"Pago" significa: soma das `PaymentAllocation` válidas maior ou igual ao total (pedido avulso ou comanda). Importados/API são considerados pagos na criação.
