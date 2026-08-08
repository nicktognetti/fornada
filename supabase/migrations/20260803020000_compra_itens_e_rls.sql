-- ============================================================
-- Migration: compra com itens ligados ao insumo + RLS por loja
-- Data: 03/08/2026
--
-- DUAS COISAS:
--
-- 1. RLS de compra/compra_item estava na geração LEGADA
--    (P2-7 da auditoria v3): usava `get_user_unidade_id()`, que devolve
--    a PRIMEIRA unidade do usuário lendo a tabela antiga
--    `fornada.usuario_unidade` — hoje congelada. Resultado: quem opera
--    duas lojas não enxergava as compras da segunda, e admin global não
--    tinha bypass. Passa para o mesmo padrão das outras tabelas
--    (fn_user_unidades / fn_is_admin_global), definido em
--    20260626000001_rls_por_loja.sql.
--
-- 2. `compra_item.insumo_id`: liga o item comprado ao insumo do sistema.
--    É o que permite a compra virar REAJUSTE DE CUSTO — até aqui o custo
--    do insumo era cadastro fixo e só mudava na mão.
-- ============================================================

-- ── 1. Item da compra aponta para o insumo ───────────────────
ALTER TABLE public.compra_item
  ADD COLUMN IF NOT EXISTS insumo_id UUID
    REFERENCES public.insumo(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.compra_item.insumo_id IS
  'Insumo do sistema correspondente a este item (NULL = item avulso, não '
  'cadastrado). Quando preenchido, a compra pode atualizar o custo do insumo.';

CREATE INDEX IF NOT EXISTS idx_compra_item_insumo
  ON public.compra_item (insumo_id)
  WHERE insumo_id IS NOT NULL;

-- ── 2. RLS de compra: para o padrão por loja ─────────────────
DROP POLICY IF EXISTS "Usuarios veem apenas registros da propria unidade" ON public.compra;
DROP POLICY IF EXISTS insert_compra_unidade ON public.compra;
DROP POLICY IF EXISTS update_compra_unidade ON public.compra;
DROP POLICY IF EXISTS delete_compra_unidade ON public.compra;
DROP POLICY IF EXISTS compra_loja ON public.compra;

CREATE POLICY compra_loja ON public.compra
  FOR ALL
  USING (
    public.fn_is_admin_global()
    OR unidade_id IN (SELECT public.fn_user_unidades())
  )
  WITH CHECK (
    public.fn_is_admin_global()
    OR unidade_id IN (SELECT public.fn_user_unidades())
  );

-- ── 3. RLS de compra_item: herda pela compra ─────────────────
DROP POLICY IF EXISTS "Usuarios veem apenas registros da propria unidade" ON public.compra_item;
DROP POLICY IF EXISTS insert_compra_item_unidade ON public.compra_item;
DROP POLICY IF EXISTS delete_compra_item_unidade ON public.compra_item;
DROP POLICY IF EXISTS compra_item_loja ON public.compra_item;

CREATE POLICY compra_item_loja ON public.compra_item
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.compra c
      WHERE c.id = compra_item.compra_id
        AND (
          public.fn_is_admin_global()
          OR c.unidade_id IN (SELECT public.fn_user_unidades())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.compra c
      WHERE c.id = compra_item.compra_id
        AND (
          public.fn_is_admin_global()
          OR c.unidade_id IN (SELECT public.fn_user_unidades())
        )
    )
  );

-- ============================================================
-- FIM
-- ============================================================
