-- ============================================================
-- Migration: RBAC — tabela permissoes + helper fn
-- Data: 19/06/2026
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. Tabela permissoes
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.permissao (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tela        TEXT        NOT NULL,
  acesso      TEXT        NOT NULL DEFAULT 'leitura'
                          CHECK (acesso IN ('leitura', 'escrita', 'admin')),
  -- NULL = permissão vale para todas as unidades
  unidade_id  UUID        REFERENCES public.unidade(id) ON DELETE CASCADE,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uk_permissao_usuario_tela_unidade
    UNIQUE (usuario_id, tela, unidade_id)
);

CREATE INDEX IF NOT EXISTS idx_permissao_usuario
  ON public.permissao(usuario_id);

COMMENT ON TABLE public.permissao IS
  'Permissões RBAC: cada linha concede (tela, acesso) a um usuário. '
  'unidade_id NULL = vale para todas as unidades.';

COMMENT ON COLUMN public.permissao.tela IS
  'Slug da tela. tela=''*'' significa acesso admin em todas as telas.';


-- ────────────────────────────────────────────────────────────
-- 2. RLS na tabela permissoes
--    - Qualquer usuário pode ler suas PRÓPRIAS permissões
--    - Somente admins (tela=''*'', acesso=''admin'') podem modificar
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.permissao ENABLE ROW LEVEL SECURITY;

-- Usuário lê apenas as próprias permissões
CREATE POLICY permissao_select_own ON public.permissao
  FOR SELECT
  USING (usuario_id = auth.uid());

-- Apenas usuários com permissão admin global podem inserir/atualizar/deletar
CREATE POLICY permissao_write_admin ON public.permissao
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.permissao p
      WHERE p.usuario_id = auth.uid()
        AND p.tela        = '*'
        AND p.acesso      = 'admin'
        AND p.unidade_id  IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.permissao p
      WHERE p.usuario_id = auth.uid()
        AND p.tela        = '*'
        AND p.acesso      = 'admin'
        AND p.unidade_id  IS NULL
    )
  );


-- ────────────────────────────────────────────────────────────
-- 3. Helper: fn_get_user_permissoes(p_user_id)
--    Retorna JSON array de {tela, acesso, unidade_id}
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_get_user_permissoes(p_user_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'tela',       p.tela,
        'acesso',     p.acesso,
        'unidade_id', p.unidade_id
      )
    ),
    '[]'::json
  )
  FROM public.permissao p
  WHERE p.usuario_id = p_user_id;
$$;

COMMENT ON FUNCTION public.fn_get_user_permissoes(uuid) IS
  'Retorna array JSON [{tela, acesso, unidade_id}] para o usuário. '
  'Executado com SECURITY DEFINER para contornar o RLS do SELECT próprio.';


-- ────────────────────────────────────────────────────────────
-- 4. Seeder: garante que todo usuário existente receba
--    permissão admin global (tela='*', unidade_id=null)
--    para não bloquear ninguém em produção ao rodar a migration.
-- ────────────────────────────────────────────────────────────

INSERT INTO public.permissao (usuario_id, tela, acesso, unidade_id)
SELECT
  u.id,
  '*',
  'admin',
  NULL
FROM auth.users u
ON CONFLICT (usuario_id, tela, unidade_id) DO NOTHING;
