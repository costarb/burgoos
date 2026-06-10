# Research: Login e Gestao de Acessos por Loja

## Decision: Autenticacao administrativa com JWT e refresh token

**Rationale**: A constituicao tecnica ja define JWT com refresh token para usuarios administrativos. Isso atende login web, validacao de sessao e expiracao controlada sem introduzir outro provedor no incremento.

**Alternatives considered**:

- Sessao server-side tradicional: simples, mas menos alinhada ao padrao tecnico documentado.
- SSO/OAuth externo: util no futuro, mas adiciona dependencia desnecessaria para o piloto.

## Decision: Tenant ativo derivado de usuario autenticado e vinculos de loja

**Rationale**: O usuario pode ter uma ou varias lojas. O servidor deve aceitar apenas stores presentes nos vinculos ativos do usuario, ou acesso global quando o usuario for master. Isso impede confiar apenas em parametros enviados pelo cliente.

**Alternatives considered**:

- Resolver tenant por subdominio na area admin: bom para ambientes multi-loja dedicados, mas menos flexivel para master e usuarios multi-loja.
- Guardar tenant apenas no frontend: inseguro, pois nao protege chamadas diretas.

## Decision: Master global separado de admins de loja

**Rationale**: O master precisa controlar todos os tenants, criar vinculos entre usuarios e lojas e preservar pelo menos um acesso global. Admins de loja devem ter autonomia local sem receber autoridade cross-tenant.

**Alternatives considered**:

- Perfil "admin" reutilizado com flag de todas as lojas: aumenta risco de configuracao errada e dificulta testar a regra do ultimo master.
- Um master por loja: nao resolve governanca global e suporte operacional.

## Decision: RBAC com perfis e permissoes granulares

**Rationale**: Perfis nomeados sao compreensiveis para negocio e permitem revisar rapidamente o que cada usuario pode fazer. Permissoes por area, tela e acao sensivel cobrem visibilidade e execucao sem expor detalhes tecnicos.

**Alternatives considered**:

- Permissoes diretamente no usuario: rapido no inicio, mas dificil de auditar e manter.
- ABAC completo por politica dinamica: poderoso, mas complexo demais para a necessidade atual.

## Decision: Desativacao logica para usuarios, perfis e vinculos

**Rationale**: A spec exige preservar historico. Desativar mantem auditoria, evita perda de rastreabilidade e permite bloquear acesso imediatamente.

**Alternatives considered**:

- Exclusao fisica: contradiz auditoria e dificulta investigacao.
- Bloqueio temporario separado de status: pode ser adicionado depois, mas nao e necessario para o MVP desta feature.

## Decision: Auditoria imutavel de eventos de acesso

**Rationale**: Login, falhas, mudancas de usuario, perfil, permissao e vinculo de loja sao eventos sensiveis. Registros imutaveis ajudam suporte, investigacao e validacao de isolamento.

**Alternatives considered**:

- Logs tecnicos apenas: insuficientes para consulta de negocio.
- Historico editavel em entidades principais: fragil e menos confiavel.

## Decision: Primeiro acesso e recuperacao de senha por token expiravel

**Rationale**: Administradores nao devem conhecer senhas de usuarios. Um fluxo com token expiravel permite criacao segura de credenciais e renovacao sem expor se o email existe no sistema.

**Alternatives considered**:

- Senha temporaria criada pelo admin: maior risco operacional.
- Criar usuarios apenas com senha manual: pior experiencia e mais suporte.
