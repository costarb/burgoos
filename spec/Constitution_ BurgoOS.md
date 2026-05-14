# Constitution: BurgoOS

**Project**: BurgoOS (SaaS Modular para Pequenos Negócios Alimentícios)
**Date**: 2026-05-13
**Version**: 1.0.0

## Vision Statement

> Permitir que pequenos negócios alimentícios operem digitalmente sem depender exclusivamente de marketplaces, através de uma plataforma modular, simples e focada em automação operacional.

## Engineering Principles

1.  **TypeScript First**: Todo o código deve ser escrito em TypeScript com tipagem estrita para garantir segurança e manutenibilidade.
2.  **Modular Monolith**: Iniciar com uma arquitetura de monólito modular para reduzir a complexidade inicial, permitindo a transição para microserviços apenas quando houver necessidade real de escala.
3.  **Domain-Oriented Design**: Organizar o código por domínios de negócio (Customer Experience, Operations, Management, Platform) em vez de camadas técnicas.
4.  **Feature-First**: Priorizar a entrega de funcionalidades completas (vertical slices) em vez de camadas horizontais.
5.  **Test-Driven Mindset**: Garantir cobertura de testes unitários para lógica de negócio e testes de integração para fluxos críticos.
6.  **Conventional Commits**: Seguir o padrão de commits convencionais para automação de changelogs e versionamento.

## Architecture Standards

*   **Backend**: NestJS com Prisma ORM e PostgreSQL.
*   **Frontend**: Next.js (App Router), TailwindCSS e React Query.
*   **Multi-tenancy**: Estratégia de Banco de Dados Compartilhado com isolamento via `tenant_id` em todas as tabelas.
*   **API**: RESTful com documentação OpenAPI (Swagger) obrigatória.
*   **Real-time**: Socket.io para atualizações de pedidos em tempo real no painel administrativo.

## Quality Standards

*   **Linting/Formatting**: ESLint e Prettier obrigatórios.
*   **Performance**: Lighthouse score > 85 em todas as páginas core.
*   **Mobile First**: Design responsivo é requisito básico, não opcional.
*   **Observability**: Logs estruturados e rastreamento de erros em todos os ambientes.

## Security Guidelines

*   **Authentication**: JWT com Refresh Tokens.
*   **Authorization**: RBAC (Role-Based Access Control) por Tenant.
*   **Data Isolation**: Filtros globais de `tenant_id` em todas as queries de banco de dados.
*   **Protection**: Rate limiting e sanitização de inputs contra ataques comuns (OWASP).

## Specification Gates

Antes de implementar uma feature, a documentação deve declarar:

*   **Escopo**: O que está incluído no MVP e o que foi explicitamente adiado para pós-MVP.
*   **Critérios de aceite**: Cada user story deve ter critérios verificáveis.
*   **Modelo de dados**: Entidades, relacionamentos, campos de auditoria e campos `tenant_id`.
*   **Tenant isolation**: Como o tenant é resolvido e como o acesso cross-tenant é bloqueado.
*   **Estratégia de testes**: Testes unitários, integração e E2E mínimos para fluxos críticos.

## Development Workflow (SDD)

1.  **Constitution**: Definir as regras do jogo (este documento).
2.  **Specify**: Criar a especificação da feature em `spec.md`.
3.  **Plan**: Criar o plano técnico em `plan.md`.
4.  **Tasks**: Quebrar o plano em tarefas granulares em `tasks.md`.
5.  **Implement**: Executar as tarefas seguindo a ordem de dependência.
