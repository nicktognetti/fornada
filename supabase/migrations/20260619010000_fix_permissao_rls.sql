-- ============================================================
-- Fix: recursão infinita no RLS da tabela permissao
-- A policy write_admin fazia SELECT na própria tabela → loop.
-- Solução: função SECURITY DEFINER para checar admin sem RLS.
-- ============================================================

-- 1. Função auxiliar que verifica admin SEM passar pelo RLS
CREATE OR REPLACE FUNCTION public.fn_is_global_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.permissao
    WHERE usuario_id = p_user_id
      AND tela       = '*'
      AND acesso     = 'admin'
      AND unidade_id IS NULL
  );
$$;

-- 2. Recriar policies sem recursão
DROP POLICY IF EXISTS permissao_select_own  ON public.permissao;
DROP POLICY IF EXISTS permissao_write_admin ON public.permissao;

-- SELECT: usuário lê apenas as próprias linhas (sem subquery → sem recursão)
CREATE POLICY permissao_select_own ON public.permissao
  FOR SELECT
  USING (usuario_id = auth.uid());

-- ALL (write): usa a função SECURITY DEFINER → bypassa RLS internamente
CREATE POLICY permissao_write_admin ON public.permissao
  FOR ALL
  USING      (public.fn_is_global_admin(auth.uid()))
  WITH CHECK (public.fn_is_global_admin(auth.uid()));

-- 3. Seeder: garante que todo usuário existente tenha permissão admin global
INSERT INTO public.permissao (usuario_id, tela, acesso, unidade_id)
SELECT u.id, '*', 'admin', NULL
FROM auth.users u
ON CONFLICT (usuario_id, tela, unidade_id) DO NOTHING;
