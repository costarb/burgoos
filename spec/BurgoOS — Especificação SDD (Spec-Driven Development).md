# BurgoOS — Especificação SDD (Spec-Driven Development)

Este repositório contém a documentação técnica completa do **BurgoOS**, uma plataforma SaaS modular projetada para pequenos negócios alimentícios. A especificação segue a metodologia **SDD** e utiliza os padrões do **GitHub Spec Kit**.

## Estrutura de Documentação

A documentação está organizada seguindo o fluxo de desenvolvimento orientado por especificações:

| Documento | Caminho | Descrição |
| :--- | :--- | :--- |
| **Constitution** | [`./Constitution_ BurgoOS.md`](./Constitution_%20BurgoOS.md) | Princípios de engenharia, padrões de código e arquitetura global. |
| **Roadmap** | [`./Roadmap_ BurgoOS.md`](./Roadmap_%20BurgoOS.md) | Visão de longo prazo dividida em fases (MVP até IA). |
| **Specification** | [`./Specification_ BurgoOS MVP.md`](./Specification_%20BurgoOS%20MVP.md) | Requisitos funcionais, histórias de usuário, critérios de aceite e escopo do MVP. |
| **Implementation Plan** | [`./Implementation Plan_ BurgoOS MVP.md`](./Implementation%20Plan_%20BurgoOS%20MVP.md) | Estratégia técnica, modelo de dados, multi-tenancy, testes e decisões de arquitetura. |
| **Task List** | [`./Tasks_ BurgoOS MVP Implementation.md`](./Tasks_%20BurgoOS%20MVP%20Implementation.md) | Lista granular de tarefas para execução da implementação. |
| **Reference Draft** | [`./sdd_spec_cardapio_web_saas_spec_kit.md`](./sdd_spec_cardapio_web_saas_spec_kit.md) | Documento inicial amplo usado como referência; não é a fonte formal de escopo do MVP. |

## Visão do Produto

O BurgoOS resolve o problema da baixa maturidade tecnológica de pequenos restaurantes, oferecendo uma alternativa aos marketplaces tradicionais com foco em:
*   **Simplicidade**: Configuração em minutos.
*   **Automação**: Integração forte com WhatsApp.
*   **Modularidade**: O lojista paga apenas pelo que usa (Cardápio, Financeiro, IA).

## Como Usar esta Especificação

Esta documentação foi preparada para ser consumida por agentes de IA ou equipes de desenvolvimento seguindo o fluxo:
1.  Leia a **Constitution** para entender as restrições técnicas.
2.  Analise a **Specification** da feature desejada.
3.  Siga o **Implementation Plan** para configurar o ambiente.
4.  Execute as tarefas listadas em **Tasks** sequencialmente.

## Fonte de Verdade

Para implementação do MVP, a fonte de verdade é:

1.  **Constitution** para princípios e restrições globais.
2.  **Specification: BurgoOS MVP** para escopo funcional, regras e critérios de aceite.
3.  **Implementation Plan: BurgoOS MVP** para decisões técnicas e modelo de dados.
4.  **Tasks: BurgoOS MVP Implementation** para execução.

O documento `sdd_spec_cardapio_web_saas_spec_kit.md` deve ser tratado como rascunho estratégico. Itens presentes nele, mas ausentes na specification do MVP, são considerados pós-MVP até que sejam promovidos explicitamente.

---
*Documentação gerada em 13 de Maio de 2026.*
