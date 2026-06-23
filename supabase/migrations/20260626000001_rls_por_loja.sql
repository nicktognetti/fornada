-- ============================================================
-- RLS por LOJA (unidade) — isolamento individual por loja — Fornada
-- Data: 26/06/2026 (confirmado contra o banco flor-do-trigo)
--
-- ⚠️⚠️ APLICAR COM BACKUP. Muda o MODELO DE ACESSO do banco.
--      Testar em staging/branch se possível.
--
-- DECISÃO (25/06): cada usuário só enxerga a(s) LOJA(S) à(s) qual(is) está
-- vinculado em public.usuario_unidade. Admin global (permissao tela='*',
-- acesso='admin', unidade_id NULL) vê TODAS as lojas.
--
-- SEGURANÇA: Natali e Nicholas já estão vinculados às 2 lojas (verificado) e são
-- admin global → não perdem acesso. Usuários restritos (ex.: Priscila futura)
-- passam a ver só a sua loja.
--
-- Substitui:
--   - o isolamento por EMPRESA (política `p_emp`)
--   - as políticas por-unidade antigas ("Usuário vê ... da sua unidade"), que liam
--     fornada.usuario_unidade (tabela quase vazia) via get_user_unidade_id()
--   - as duplicatas de empresa em produto/produto_preco
--
-- Lê os vínculos de public.usuario_unidade (a tabela populada — 4 vínculos).
-- Tabelas filhas derivam a loja do pai quando precisam.
-- ============================================================

-- ── Helpers ──────────────────────────────────────────────────
-- Conjunto de lojas do usuário logado (lê a tabela CORRETA: public.usuario_unidade)
CREATE OR REPLACE FUNCTION public.fn_user_unidades()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT unidade_id FROM public.usuario_unidade WHERE user_id = auth.uid();
$$;

-- Usuário é admin global? (vê todas as lojas)
CREATE OR REPLACE FUNCTION public.fn_is_admin_global()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.permissao p
    WHERE p.usuario_id = auth.uid()
      AND p.tela = '*' AND p.acesso = 'admin' AND p.unidade_id IS NULL
  );
$$;

-- ── insumo (unidade_id direto) ───────────────────────────────
DROP POLICY IF EXISTS p_emp ON public.insumo;
DROP POLICY IF EXISTS "Usuário vê insumos da sua unidade" ON public.insumo;
DROP POLICY IF EXISTS insumo_empresa ON public.insumo;
DROP POLICY IF EXISTS insumo_loja ON public.insumo;
CREATE POLICY insumo_loja ON public.insumo FOR ALL
  USING      (public.fn_is_admin_global() OR unidade_id IN (SELECT public.fn_user_unidades()))
  WITH CHECK (public.fn_is_admin_global() OR unidade_id IN (SELECT public.fn_user_unidades()));

-- ── receita (unidade_id direto) ──────────────────────────────
DROP POLICY IF EXISTS p_emp ON public.receita;
DROP POLICY IF EXISTS "Usuário vê receitas da sua unidade" ON public.receita;
DROP POLICY IF EXISTS receita_empresa ON public.receita;
DROP POLICY IF EXISTS receita_loja ON public.receita;
CREATE POLICY receita_loja ON public.receita FOR ALL
  USING      (public.fn_is_admin_global() OR unidade_id IN (SELECT public.fn_user_unidades()))
  WITH CHECK (public.fn_is_admin_global() OR unidade_id IN (SELECT public.fn_user_unidades()));

-- ── produto (unidade_id direto) ──────────────────────────────
DROP POLICY IF EXISTS p_emp ON public.produto;
DROP POLICY IF EXISTS "Usuário vê produtos da sua unidade" ON public.produto;
DROP POLICY IF EXISTS produto_por_empresa ON public.produto;
DROP POLICY IF EXISTS produto_empresa ON public.produto;
DROP POLICY IF EXISTS produto_empresa_rls ON public.produto;
DROP POLICY IF EXISTS produto_loja ON public.produto;
CREATE POLICY produto_loja ON public.produto FOR ALL
  USING      (public.fn_is_admin_global() OR unidade_id IN (SELECT public.fn_user_unidades()))
  WITH CHECK (public.fn_is_admin_global() OR unidade_id IN (SELECT public.fn_user_unidades()));

-- ── produto_preco (unidade_id direto; NOT NULL na prática) ────
DROP POLICY IF EXISTS p_emp ON public.produto_preco;
DROP POLICY IF EXISTS "Usuário vê preços de produtos da sua unidade" ON public.produto_preco;
DROP POLICY IF EXISTS produto_preco_empresa ON public.produto_preco;
DROP POLICY IF EXISTS produto_preco_loja ON public.produto_preco;
CREATE POLICY produto_preco_loja ON public.produto_preco FOR ALL
  USING      (public.fn_is_admin_global() OR unidade_id IN (SELECT public.fn_user_unidades()))
  WITH CHECK (public.fn_is_admin_global() OR unidade_id IN (SELECT public.fn_user_unidades()));

-- ── insumo_preco (via insumo; unidade_id do preço pode ser NULL) ─
DROP POLICY IF EXISTS p_emp ON public.insumo_preco;
DROP POLICY IF EXISTS "Usuário vê preços de insumos da sua unidade" ON public.insumo_preco;
DROP POLICY IF EXISTS insumo_preco_empresa ON public.insumo_preco;
DROP POLICY IF EXISTS insumo_preco_loja ON public.insumo_preco;
CREATE POLICY insumo_preco_loja ON public.insumo_preco FOR ALL
  USING (public.fn_is_admin_global() OR insumo_id IN (
    SELECT id FROM public.insumo WHERE unidade_id IN (SELECT public.fn_user_unidades())))
  WITH CHECK (public.fn_is_admin_global() OR insumo_id IN (
    SELECT id FROM public.insumo WHERE unidade_id IN (SELECT public.fn_user_unidades())));

-- ── receita_item (via receita; não tem unidade_id próprio) ────
DROP POLICY IF EXISTS p_emp ON public.receita_item;
DROP POLICY IF EXISTS "Usuário vê itens de receita da sua unidade" ON public.receita_item;
DROP POLICY IF EXISTS receita_item_empresa ON public.receita_item;
DROP POLICY IF EXISTS receita_item_loja ON public.receita_item;
CREATE POLICY receita_item_loja ON public.receita_item FOR ALL
  USING (public.fn_is_admin_global() OR receita_id IN (
    SELECT id FROM public.receita WHERE unidade_id IN (SELECT public.fn_user_unidades())))
  WITH CHECK (public.fn_is_admin_global() OR receita_id IN (
    SELECT id FROM public.receita WHERE unidade_id IN (SELECT public.fn_user_unidades())));

-- ── Verificação pós-aplicação ────────────────────────────────
--   select tablename, policyname, cmd from pg_policies
--   where schemaname='public'
--     and tablename in ('insumo','insumo_preco','receita','receita_item','produto','produto_preco')
--   order by 1,2;
--   -- Esperado: 1 política _loja por tabela.
--   -- Testar: entrar como um usuário restrito (1 loja) e conferir que só vê a loja dele.
