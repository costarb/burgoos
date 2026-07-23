# Research: Cardapio por dominio da loja

## Dominio no cadastro da loja

**Decision**: Adicionar um campo opcional `publicDomain` diretamente em `Tenant`, com indice unico e valor canonico sem `www.`.

**Rationale**: A relacao solicitada e um-para-um e nao exige historico, varios aliases ou verificacao automatica nesta entrega. A restricao no banco protege concorrencia entre administradores.

**Alternatives considered**:

- Guardar em `Tenant.config`: rejeitado porque nao oferece unicidade transacional nem busca eficiente por host.
- Criar tabela de dominios: adiado ate existir necessidade real de varios dominios, estados de verificacao ou redirecionamentos.

## Resolucao do tenant

**Decision**: O frontend extrai o host original e chama um endpoint publico de cardapio por dominio. A API normaliza novamente o valor e resolve somente tenant ativo.

**Rationale**: O frontend recebe o dominio comercial, enquanto a API concentra isolamento e consulta de dados. Normalizacao nas duas fronteiras melhora UX sem confiar no cliente.

**Alternatives considered**:

- Middleware reescrevendo diretamente para `/{slug}`: exige descobrir o slug antes da reescrita e mistura chamada remota no middleware.
- Proxy reverso externo com uma regra por loja: cria gargalo operacional e exige deploy/configuracao de infraestrutura para cada estabelecimento.

## Normalizacao do host

**Decision**: Aceitar somente hostname, converter para minusculas, remover porta, ponto final e um prefixo `www.`. Rejeitar protocolo, caminho, credenciais, espacos e host vazio no cadastro.

**Rationale**: Produz uma chave deterministica e impede que formas equivalentes sejam cadastradas por lojas diferentes.

**Alternatives considered**:

- Preservar `www.` como dominio independente: rejeitado por permitir colisao comercial e comportamento inesperado.
- Aceitar URL completa e extrair host: rejeitado no cadastro para tornar erros visiveis ao administrador.

## Compatibilidade e checkout

**Decision**: Manter `/{slug}` e `/{slug}/pedido/{id}`. A nova pagina `/cardapio` reutiliza o componente existente e informa uma base de navegacao para usar `/cardapio/pedido/{id}`.

**Rationale**: Links antigos continuam funcionando e a nova experiencia nao vaza o slug na URL apos finalizar a compra.

**Alternatives considered**:

- Redirecionar toda rota legada para dominio: rejeitado porque lojas sem dominio e links de desenvolvimento precisam continuar operando.

## Cache e alteracoes administrativas

**Decision**: Resolver o dominio em cada revalidacao da pagina, com janela maxima de 30 segundos, e nunca servir cache obsoleto de um dominio diferente como fallback.

**Rationale**: Atende o limite de 60 segundos da especificacao e evita vazamento entre lojas durante troca ou remocao de dominio.

**Alternatives considered**:

- Cache longo com invalidacao distribuida: desnecessario para a escala atual e mais sujeito a falhas operacionais.

## DNS e HTTPS

**Decision**: Tratar DNS, cadastro do custom domain na hospedagem e emissao de certificado como pre-requisitos operacionais externos.

**Rationale**: A aplicacao consegue resolver o `Host`, mas nao controla os provedores de DNS nem o roteamento TLS da infraestrutura.

**Alternatives considered**:

- Automatizar provedores de DNS: fora do escopo e dependente de fornecedor.
