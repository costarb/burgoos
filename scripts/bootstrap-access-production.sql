-- Bootstrap inicial de acesso para producao.
-- Execute depois de aplicar as migrations Prisma.
--
-- Usuarios criados/atualizados:
--   platform@burgoos.local / admin123
--   admin@burgoos.local / admin123
--   loja.admin@burgoos.local / admin123
--   operador@burgoos.local / admin123
--
-- Troque as senhas apos o primeiro acesso.

BEGIN;

INSERT INTO layout_presets (
  key,
  name,
  description,
  target_surface,
  active,
  created_at,
  updated_at
)
VALUES (
  'classic',
  'Classico',
  'Menu familiar com categorias em destaque.',
  'PUBLIC_MENU',
  true,
  now(),
  now()
)
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  target_surface = EXCLUDED.target_surface,
  active = true,
  updated_at = now();

INSERT INTO tenants (
  id,
  name,
  slug,
  phone,
  active,
  is_open,
  setup_completed_at,
  default_layout_preset_key,
  config,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'Loja Piloto',
  'piloto',
  '5500000000000',
  true,
  true,
  now(),
  'classic',
  '{"pixInstructions":"Chave PIX da loja piloto","openingHours":"18:00-23:00"}'::jsonb,
  now(),
  now()
)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  active = true,
  is_open = EXCLUDED.is_open,
  setup_completed_at = COALESCE(tenants.setup_completed_at, EXCLUDED.setup_completed_at),
  default_layout_preset_key = EXCLUDED.default_layout_preset_key,
  config = EXCLUDED.config,
  updated_at = now();

INSERT INTO platform_users (
  id,
  role,
  name,
  email,
  password_hash,
  active,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-4000-8000-000000000010',
  'SUPER_ADMIN',
  'Admin Plataforma',
  'platform@burgoos.local',
  '$2a$10$SvsgcvCTvdXaPh.6jm/wAeKt.lHjyHmYidoERHb4bM6zuH4UliI8a',
  true,
  now(),
  now()
)
ON CONFLICT (email) DO UPDATE
SET
  role = 'SUPER_ADMIN',
  name = EXCLUDED.name,
  active = true,
  updated_at = now();

INSERT INTO permissions (
  id,
  key,
  area,
  screen,
  action,
  description,
  sensitive,
  created_at,
  updated_at
)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'orders.view', 'Operacao', 'Pedidos', 'VIEW', 'Visualizar pedidos e historico operacional', false, now(), now()),
  ('10000000-0000-4000-8000-000000000002', 'orders.manage', 'Operacao', 'Pedidos', 'MANAGE', 'Atualizar status e realizar manutencao de pedidos', true, now(), now()),
  ('10000000-0000-4000-8000-000000000003', 'catalog.manage', 'Cardapio', 'Catalogo', 'MANAGE', 'Criar e alterar categorias e produtos', false, now(), now()),
  ('10000000-0000-4000-8000-000000000004', 'finance.view', 'Financeiro', 'Caixa e contas', 'VIEW', 'Visualizar contas, saldo e relatorios financeiros', true, now(), now()),
  ('10000000-0000-4000-8000-000000000005', 'finance.manage', 'Financeiro', 'Caixa e contas', 'MANAGE', 'Gerenciar contas, pagamentos e movimentos financeiros', true, now(), now()),
  ('10000000-0000-4000-8000-000000000006', 'access.users.manage', 'Acessos', 'Usuarios', 'MANAGE', 'Criar, alterar, ativar e desativar usuarios', true, now(), now()),
  ('10000000-0000-4000-8000-000000000007', 'access.profiles.manage', 'Acessos', 'Perfis', 'MANAGE', 'Criar e alterar perfis e permissoes', true, now(), now()),
  ('10000000-0000-4000-8000-000000000008', 'access.audit.view', 'Acessos', 'Auditoria', 'VIEW', 'Consultar historico de autenticacao e mudancas de acesso', true, now(), now())
ON CONFLICT (key) DO UPDATE
SET
  area = EXCLUDED.area,
  screen = EXCLUDED.screen,
  action = EXCLUDED.action,
  description = EXCLUDED.description,
  sensitive = EXCLUDED.sensitive,
  updated_at = now();

INSERT INTO access_profiles (
  id,
  tenant_id,
  name,
  description,
  scope,
  status,
  created_at,
  updated_at
)
SELECT
  '20000000-0000-4000-8000-000000000001',
  NULL,
  'Master',
  'Controle completo da plataforma administrativa.',
  'GLOBAL'::"AccessProfileScope",
  'ACTIVE'::"AccessProfileStatus",
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1
  FROM access_profiles
  WHERE tenant_id IS NULL AND name = 'Master'
);

UPDATE access_profiles
SET
  description = 'Controle completo da plataforma administrativa.',
  scope = 'GLOBAL'::"AccessProfileScope",
  status = 'ACTIVE'::"AccessProfileStatus",
  updated_at = now()
WHERE tenant_id IS NULL AND name = 'Master';

INSERT INTO access_profiles (
  id,
  tenant_id,
  name,
  description,
  scope,
  status,
  created_at,
  updated_at
)
SELECT
  profile_seed.id,
  tenant.id,
  profile_seed.name,
  profile_seed.description,
  profile_seed.scope,
  profile_seed.status,
  now(),
  now()
FROM tenants tenant
CROSS JOIN (
  VALUES
    ('20000000-0000-4000-8000-000000000002'::uuid, 'Admin da loja', 'Gerencia operacao e acessos da loja piloto.', 'STORE'::"AccessProfileScope", 'ACTIVE'::"AccessProfileStatus"),
    ('20000000-0000-4000-8000-000000000003'::uuid, 'Operador', 'Acompanha e atualiza a operacao diaria.', 'STORE'::"AccessProfileScope", 'ACTIVE'::"AccessProfileStatus")
) AS profile_seed(id, name, description, scope, status)
WHERE tenant.slug = 'piloto'
ON CONFLICT (tenant_id, name) DO UPDATE
SET
  description = EXCLUDED.description,
  scope = EXCLUDED.scope,
  status = 'ACTIVE'::"AccessProfileStatus",
  updated_at = now();

INSERT INTO access_profile_permissions (profile_id, permission_id, created_at)
SELECT profile.id, permission.id, now()
FROM access_profiles profile
CROSS JOIN permissions permission
WHERE profile.tenant_id IS NULL
  AND profile.name = 'Master'
ON CONFLICT (profile_id, permission_id) DO NOTHING;

INSERT INTO access_profile_permissions (profile_id, permission_id, created_at)
SELECT profile.id, permission.id, now()
FROM access_profiles profile
JOIN permissions permission ON permission.key IN (
  'orders.view',
  'orders.manage',
  'catalog.manage',
  'finance.view',
  'access.users.manage',
  'access.audit.view'
)
JOIN tenants tenant ON tenant.id = profile.tenant_id
WHERE tenant.slug = 'piloto'
  AND profile.name = 'Admin da loja'
ON CONFLICT (profile_id, permission_id) DO NOTHING;

INSERT INTO access_profile_permissions (profile_id, permission_id, created_at)
SELECT profile.id, permission.id, now()
FROM access_profiles profile
JOIN permissions permission ON permission.key IN ('orders.view', 'orders.manage')
JOIN tenants tenant ON tenant.id = profile.tenant_id
WHERE tenant.slug = 'piloto'
  AND profile.name = 'Operador'
ON CONFLICT (profile_id, permission_id) DO NOTHING;

INSERT INTO users (
  id,
  tenant_id,
  role,
  status,
  is_master,
  name,
  email,
  password_hash,
  created_at,
  updated_at
)
SELECT
  user_seed.id,
  tenant.id,
  user_seed.role,
  user_seed.status,
  user_seed.is_master,
  user_seed.name,
  user_seed.email,
  user_seed.password_hash,
  now(),
  now()
FROM tenants tenant
CROSS JOIN (
  VALUES
    ('30000000-0000-4000-8000-000000000001'::uuid, 'OWNER'::"UserRole", 'ACTIVE'::"AccessUserStatus", true, 'Admin Piloto', 'admin@burgoos.local', '$2a$10$SvsgcvCTvdXaPh.6jm/wAeKt.lHjyHmYidoERHb4bM6zuH4UliI8a'),
    ('30000000-0000-4000-8000-000000000002'::uuid, 'ADMIN'::"UserRole", 'ACTIVE'::"AccessUserStatus", false, 'Admin Loja Piloto', 'loja.admin@burgoos.local', '$2a$10$SvsgcvCTvdXaPh.6jm/wAeKt.lHjyHmYidoERHb4bM6zuH4UliI8a'),
    ('30000000-0000-4000-8000-000000000003'::uuid, 'OPERATOR'::"UserRole", 'ACTIVE'::"AccessUserStatus", false, 'Operador Piloto', 'operador@burgoos.local', '$2a$10$SvsgcvCTvdXaPh.6jm/wAeKt.lHjyHmYidoERHb4bM6zuH4UliI8a')
) AS user_seed(id, role, status, is_master, name, email, password_hash)
WHERE tenant.slug = 'piloto'
ON CONFLICT (email) DO UPDATE
SET
  tenant_id = EXCLUDED.tenant_id,
  role = EXCLUDED.role,
  status = 'ACTIVE'::"AccessUserStatus",
  is_master = EXCLUDED.is_master,
  name = EXCLUDED.name,
  updated_at = now();

INSERT INTO user_store_assignments (
  id,
  user_id,
  tenant_id,
  profile_id,
  can_manage_store_access,
  status,
  created_at,
  updated_at
)
SELECT
  '40000000-0000-4000-8000-000000000001',
  user_account.id,
  tenant.id,
  profile.id,
  true,
  'ACTIVE'::"AccessProfileStatus",
  now(),
  now()
FROM users user_account
JOIN tenants tenant ON tenant.slug = 'piloto'
JOIN access_profiles profile ON profile.tenant_id IS NULL AND profile.name = 'Master'
WHERE user_account.email = 'admin@burgoos.local'
ON CONFLICT (user_id, tenant_id) DO UPDATE
SET
  profile_id = EXCLUDED.profile_id,
  can_manage_store_access = true,
  status = 'ACTIVE'::"AccessProfileStatus",
  updated_at = now();

INSERT INTO user_store_assignments (
  id,
  user_id,
  tenant_id,
  profile_id,
  can_manage_store_access,
  status,
  created_at,
  updated_at
)
SELECT
  '40000000-0000-4000-8000-000000000002',
  user_account.id,
  tenant.id,
  profile.id,
  true,
  'ACTIVE'::"AccessProfileStatus",
  now(),
  now()
FROM users user_account
JOIN tenants tenant ON tenant.slug = 'piloto'
JOIN access_profiles profile ON profile.tenant_id = tenant.id AND profile.name = 'Admin da loja'
WHERE user_account.email = 'loja.admin@burgoos.local'
ON CONFLICT (user_id, tenant_id) DO UPDATE
SET
  profile_id = EXCLUDED.profile_id,
  can_manage_store_access = true,
  status = 'ACTIVE'::"AccessProfileStatus",
  updated_at = now();

INSERT INTO user_store_assignments (
  id,
  user_id,
  tenant_id,
  profile_id,
  can_manage_store_access,
  status,
  created_at,
  updated_at
)
SELECT
  '40000000-0000-4000-8000-000000000003',
  user_account.id,
  tenant.id,
  profile.id,
  false,
  'ACTIVE'::"AccessProfileStatus",
  now(),
  now()
FROM users user_account
JOIN tenants tenant ON tenant.slug = 'piloto'
JOIN access_profiles profile ON profile.tenant_id = tenant.id AND profile.name = 'Operador'
WHERE user_account.email = 'operador@burgoos.local'
ON CONFLICT (user_id, tenant_id) DO UPDATE
SET
  profile_id = EXCLUDED.profile_id,
  can_manage_store_access = false,
  status = 'ACTIVE'::"AccessProfileStatus",
  updated_at = now();

COMMIT;
