# Cardápio Web SaaS — Especificação Inicial (SDD + Spec Kit)

> Nota: este documento é um rascunho estratégico amplo. Para implementação do MVP, use como fonte de verdade os documentos `Specification_ BurgoOS MVP.md`, `Implementation Plan_ BurgoOS MVP.md` e `Tasks_ BurgoOS MVP Implementation.md`. Itens citados aqui, mas ausentes na specification do MVP, são considerados pós-MVP.

## Referências

- Spec Kit Oficial: https://github.com/github/spec-kit
- Documentação: https://github.github.io/spec-kit/

---

# 1. Visão do Produto

## Nome Temporário

BurgoOS

## Problema

Pequenos restaurantes, hamburguerias, pizzarias e operações delivery possuem baixa maturidade tecnológica.

Grande parte:

- depende exclusivamente do iFood;
- controla pedidos manualmente;
- não possui visibilidade financeira;
- não possui CRM de clientes;
- perde pedidos no WhatsApp;
- não consegue medir lucratividade;
- não possui automação operacional.

Além disso, soluções robustas possuem:

- custo elevado;
- curva de aprendizado complexa;
- excesso de funcionalidades;
- foco em médias/grandes operações.

## Objetivo

Criar uma plataforma SaaS modular para pequenos negócios alimentícios com:

- Cardápio digital;
- Gestão de pedidos;
- WhatsApp como canal principal;
- Painel operacional;
- Gestão financeira simplificada;
- CRM básico;
- Automação operacional;
- Possibilidade futura de IA operacional.

## Público-Alvo

### Inicial

- Hamburguerias locais;
- Delivery artesanal;
- Marmitarias;
- Pizzarias pequenas;
- Lanchonetes;
- Dark kitchens.

### Futuro

- Franquias pequenas;
- Redes locais;
- Food trucks;
- Multi-loja.

---

# 2. Product Vision (Spec Kit Style)

## Vision Statement

Permitir que pequenos negócios alimentícios operem digitalmente sem depender exclusivamente de marketplaces.

## Success Metrics

### MVP

- Primeiro restaurante operando em produção;
- Tempo médio de criação de cardápio < 20 minutos;
- Pedido realizado em menos de 5 cliques;
- Recebimento de pedidos via WhatsApp;
- Dashboard básico financeiro;
- Taxa de erro operacional baixa.

### Pós-MVP

- Multi-tenant funcionando;
- Cobrança recorrente automatizada;
- Integração pagamento online;
- Recuperação de carrinho;
- Fidelidade;
- CRM.

### Longo Prazo

- IA para atendimento;
- IA operacional;
- Analytics avançado;
- Integração com marketplaces;
- Ecossistema modular.

---

# 3. Escopo Inicial (MVP)

## Funcionalidades Core

### 3.1 Cardápio Digital

#### Requisitos

- Exibir categorias;
- Exibir produtos;
- Exibir adicionais;
- Exibir imagens;
- Exibir disponibilidade;
- Horário funcionamento;
- Link compartilhável;
- QR Code;
- Tema customizável.

#### Regras

- Produto indisponível não pode ser comprado;
- Loja fechada impede novos pedidos;
- Produto deve permitir observações.

---

### 3.2 Pedido Online

#### Fluxo

1. Cliente acessa cardápio;
2. Escolhe produtos;
3. Adiciona complementos;
4. Define entrega/retirada;
5. Informa dados;
6. Escolhe pagamento;
7. Confirma pedido.

#### Requisitos

- Carrinho;
- Taxa de entrega;
- CEP/bairro;
- PIX;
- Dinheiro;
- Cartão na entrega;
- WhatsApp fallback.

---

### 3.3 Painel Administrativo

#### Requisitos

- CRUD produtos;
- CRUD categorias;
- CRUD adicionais;
- Gestão pedidos;
- Alteração status;
- Relatórios básicos;
- Horários funcionamento;
- Configuração entrega.

#### Status Pedido

- Novo;
- Em preparo;
- Saiu para entrega;
- Finalizado;
- Cancelado.

---

### 3.4 WhatsApp Integration

#### Objetivos

- Receber pedidos;
- Notificar status;
- Recuperar abandono;
- Comunicação cliente.

#### Fase Inicial

- Deep link WhatsApp;
- Templates prontos;
- Mensagens automáticas.

#### Futuro

- WhatsApp Cloud API;
- Bot IA;
- Atendimento automatizado.

---

### 3.5 Gestão Financeira Básica

#### Funcionalidades

- Receita diária;
- Ticket médio;
- Produtos mais vendidos;
- Pedidos por período;
- Controle simples despesas.

---

# 4. Arquitetura Inicial

## Estratégia

Monólito modular inicialmente.

Objetivo:

- reduzir complexidade;
- acelerar entrega;
- simplificar manutenção.

Microserviços somente após necessidade real.

---

## Stack Recomendada

### Frontend

- Next.js;
- React;
- TypeScript;
- TailwindCSS.

### Backend

- NestJS;
- TypeScript;
- Prisma ORM.

### Banco

- PostgreSQL.

### Infraestrutura

- Docker;
- Railway ou Render inicialmente;
- Cloudflare;
- GitHub Actions.

### Tempo Real

- Socket.IO.

### Storage

- S3 compatible.

### Auth

- JWT;
- Refresh Token.

---

# 5. Multi-Tenant Strategy

## Modelo Inicial

Shared Database + Tenant ID.

## Motivo

- menor custo;
- simplicidade operacional;
- rapidez.

## Regras

Toda entidade deve possuir:

- tenant_id;
- auditoria básica;
- created_at;
- updated_at.

---

# 6. Entidades Principais

## Tenant

- id
- name
- slug
- plan
- active

## User

- id
- tenant_id
- role
- name
- email
- password_hash

## Category

- id
- tenant_id
- name
- sort_order
- active

## Product

- id
- tenant_id
- category_id
- name
- description
- image_url
- price
- active

## Addon

- id
- tenant_id
- product_id
- name
- price

## Order

- id
- tenant_id
- customer_name
- customer_phone
- status
- total
- payment_method

## OrderItem

- id
- order_id
- product_id
- quantity
- unit_price

---

# 7. Domínios do Sistema

## Customer Experience Domain

Responsável por:

- cardápio;
- checkout;
- pedidos;
- experiência cliente.

## Operations Domain

Responsável por:

- fila pedidos;
- status;
- cozinha;
- entrega.

## Management Domain

Responsável por:

- financeiro;
- relatórios;
- analytics.

## Platform Domain

Responsável por:

- autenticação;
- billing;
- multi-tenant;
- observabilidade.

---

# 8. Não Funcionais

## Performance

- TTFB baixo;
- Mobile first;
- Lighthouse > 85.

## Segurança

- Rate limit;
- JWT seguro;
- Hash bcrypt/argon2;
- Tenant isolation.

## Escalabilidade

- Horizontal scaling;
- CDN imagens;
- Cache catálogo.

## Observabilidade

- Logs estruturados;
- Monitoring;
- Error tracking.

---

# 9. Roadmap

## Fase 1 — MVP

- Cardápio;
- Pedido;
- Painel;
- WhatsApp;
- Financeiro básico.

## Fase 2 — Operação

- Impressão;
- KDS;
- Entregadores;
- Rastreamento;
- Pagamento online.

## Fase 3 — Growth

- Fidelidade;
- CRM;
- Cupons;
- Remarketing.

## Fase 4 — IA

- Bot atendimento;
- IA vendas;
- Sugestão campanhas;
- Analytics IA.

---

# 10. Organização do Repositório

## Estrutura Inicial

```txt
/apps
  /web
  /api

/packages
  /ui
  /types
  /eslint-config
  /tsconfig

/infrastructure
  /docker
  /nginx
  /terraform

/docs
  /specs
  /architecture
  /adr
```

---

# 11. Fluxo SDD com Spec Kit

## Fase 1 — Constitution

Definir:

- princípios engenharia;
- padrões qualidade;
- segurança;
- convenções;
- testes;
- UX;
- observabilidade.

### Exemplo

- TypeScript obrigatório;
- Cobertura mínima testes;
- Mobile-first;
- Clean Architecture;
- Observabilidade obrigatória.

---

## Fase 2 — Specify

Criar especificações por feature.

Exemplos:

- cardápio digital;
- checkout;
- gestão pedidos;
- login;
- financeiro.

Cada feature deve possuir:

- contexto;
- problema;
- objetivos;
- fluxos;
- critérios aceitação;
- edge cases;
- regras negócio.

---

## Fase 3 — Plan

Definir:

- arquitetura;
- componentes;
- dependências;
- decisões técnicas;
- estratégia testes.

---

## Fase 4 — Tasks

Quebrar em tarefas executáveis.

Exemplo:

- criar entidade Product;
- criar migration;
- criar endpoint listagem;
- criar tela admin;
- criar cache.

---

## Fase 5 — Implement

Executar implementação baseada nos artefatos.

---

# 12. Constitution Inicial

## Engenharia

- TypeScript obrigatório;
- ESLint obrigatório;
- Prettier obrigatório;
- Conventional Commits;
- CI obrigatório.

## Arquitetura

- Modular monolith;
- Domain-oriented;
- Feature-first;
- SOLID.

## Backend

- DTO validation;
- OpenAPI obrigatório;
- Repository pattern;
- Service layer.

## Frontend

- Server Components quando possível;
- React Query;
- Responsividade obrigatória.

## Banco

- Migrations obrigatórias;
- Soft delete quando necessário;
- Auditoria mínima.

## Segurança

- JWT;
- Rate limiting;
- Sanitização;
- OWASP.

## Testes

- Unitários;
- Integração;
- E2E nos fluxos críticos.

---

# 13. Primeiras Features para Spec Kit

## Feature 001 — Tenant Onboarding

Objetivo:

Permitir criação de loja.

Inclui:

- cadastro;
- slug;
- plano;
- admin user.

---

## Feature 002 — Product Catalog

Objetivo:

Gerenciar cardápio.

Inclui:

- categorias;
- produtos;
- adicionais;
- disponibilidade.

---

## Feature 003 — Checkout

Objetivo:

Permitir pedidos online.

Inclui:

- carrinho;
- entrega;
- pagamento;
- confirmação.

---

## Feature 004 — Order Management

Objetivo:

Gerenciar pedidos.

Inclui:

- fila;
- status;
- notificações.

---

# 14. Prompt Base para IA

## System Prompt Estratégico

"Você é um engenheiro de software especialista em SaaS multi-tenant, arquitetura escalável, NestJS, Next.js e Spec-Driven Development.

Toda implementação deve:

- seguir os artefatos do Spec Kit;
- respeitar arquitetura modular;
- evitar acoplamento;
- priorizar legibilidade;
- gerar código production-ready;
- manter rastreabilidade entre specification, plan e tasks;
- criar testes;
- validar edge cases;
- evitar overengineering.

Nunca implemente funcionalidades fora do escopo definido na specification atual."

---

# 15. Próximos Passos Recomendados

## Passo 1

Criar repositório monorepo.

## Passo 2

Instalar Spec Kit.

```bash
uvx --from git+https://github.com/github/spec-kit.git specify init
```

## Passo 3

Criar constitution.

## Passo 4

Criar primeira feature:

- Tenant onboarding.

## Passo 5

Gerar:

- spec.md;
- plan.md;
- tasks.md.

## Passo 6

Executar implementação guiada por IA.

---

# 16. Sugestão Estratégica

O maior diferencial do produto provavelmente não será o cardápio.

Os diferenciais mais fortes tendem a ser:

- automação WhatsApp;
- operação simplificada;
- visibilidade financeira;
- retenção cliente;
- CRM;
- analytics;
- IA operacional.

O cardápio digital deve ser visto como porta de entrada do ecossistema.
